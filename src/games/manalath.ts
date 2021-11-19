import { GameBase, IAPGameState, IIndividualState } from "./_base";
import { APGamesInformation } from "../schemas/gameinfo";
import { APRenderRep } from "@abstractplay/renderer/src/schema";
import { APMoveResult } from "../schemas/moveresults";
import { reviver, UserFacingError } from "../common";
import i18next from "i18next";
import { HexTriGraph } from "../common/graphs";
// tslint:disable-next-line: no-var-requires
const deepclone = require("rfdc/default");

const gameDesc:string = `# Manalath

Manalath is a game on a hexagonal grid where you can place pieces of either colour. You win if at the end of your turn there's a group of five pieces of your colour, but you *lose* if there's a group of four stones of your colour. How are you going to do that?!
`;

export type playerid = 1|2;

export interface IMoveState extends IIndividualState {
    currplayer: playerid;
    board: Map<string, playerid>;
    lastmove?: string;
};

export interface IManalathState extends IAPGameState {
    winner: playerid[];
    stack: Array<IMoveState>;
};

export class ManalathGame extends GameBase {
    public static readonly gameinfo: APGamesInformation = {
        name: "Manalath",
        uid: "manalath",
        playercounts: [2],
        version: "20211118",
        description: gameDesc,
        urls: ["https://spielstein.com/games/manalath/rules"],
        people: [
            {
                type: "designer",
                name: "Dieter Stein",
                urls: ["https://spielstein.com/"]
            },
            {
                type: "designer",
                name: "Néstor Romeral Andrés",
                urls: ["http://nestorgames.com/"]
            }
        ]
    };

    public numplayers: number = 2;
    public currplayer: playerid = 1;
    public board!: Map<string, playerid>;
    public lastmove?: string;
    public graph: HexTriGraph = new HexTriGraph(5, 9);
    public gameover: boolean = false;
    public winner: playerid[] = [];
    public variants: string[] = [];
    public stack!: Array<IMoveState>;
    public results: Array<APMoveResult> = [];

    constructor(state?: IManalathState | string, variants?: string[]) {
        super();
        if (state === undefined) {
            const fresh: IMoveState = {
                _version: ManalathGame.gameinfo.version,
                _results: [],
                currplayer: 1,
                board: new Map(),
            };
            this.stack = [fresh];
        } else {
            if (typeof state === "string") {
                state = JSON.parse(state, reviver) as IManalathState;
            }
            if (state.game !== ManalathGame.gameinfo.uid) {
                throw new Error(`The Manalath engine cannot process a game of '${state.game}'.`);
            }
            this.gameover = state.gameover;
            this.winner = [...state.winner];
            this.variants = state.variants;
            this.stack = [...state.stack];
        }
        this.load();
    }

    public load(idx: number = -1): ManalathGame {
        if (idx < 0) {
            idx += this.stack.length;
        }
        if ( (idx < 0) || (idx >= this.stack.length) ) {
            throw new Error("Could not load the requested state from the stack.");
        }

        const state = this.stack[idx];
        this.currplayer = state.currplayer;
        this.board = new Map(state.board);
        this.lastmove = state.lastmove;
        this.buildGraph();
        return this;
    }

    private buildGraph(): ManalathGame {
        this.graph = new HexTriGraph(5, 9);
        return this;
    }

    public moves(player?: playerid): string[] {
        if (this.gameover) { return []; }
        if (player === undefined) {
            player = this.currplayer;
        }

        const moves: string[] = [];
        const empties = (this.graph.listCells() as string[]).filter(c => ! this.board.has(c));
        for (const cell of empties) {
            for (const colour of ["w", "b"]) {
                moves.push(`${cell}${colour}`);
            }
        }
        const valid = moves.filter(m => {
            const g: ManalathGame = Object.assign(new ManalathGame(), deepclone(this));
            g.buildGraph();
            g.move(m, true);
            const groups1 = g.getGroups(1);
            const groups2 = g.getGroups(2);
            return ( (groups1.filter(grp => grp.size > 5).length === 0) && (groups2.filter(grp => grp.size > 5)) );
        });

        if (valid.length === 0) {
            return ["pass"];
        } else {
            return [...valid];
        }
    }

    public randomMove(): string {
        const moves = this.moves();
        return moves[Math.floor(Math.random() * moves.length)];
    }

    public click(row: number, col: number, piece: string): string {
        if (piece === '')
            return String.fromCharCode(97 + col) + (8 - row).toString();
        else
            return 'x' + String.fromCharCode(97 + col) + (8 - row).toString();
    }

    public clicked(move: string, coord: string): string {
        if (move.length > 0 && move.length < 3) {
            if (coord.length === 2)
                return move + '-' + coord;
            else
                return move + coord;
        }
        else {
            if (coord.length === 2)
                return coord;
            else
                return coord.substring(1, 3);
        }
    }

    public move(m: string, partial: boolean = false): ManalathGame {
        if (this.gameover) {
            throw new UserFacingError("MOVES_GAMEOVER", i18next.t("apgames:MOVES_GAMEOVER"));
        }
        m = m.toLowerCase();
        m = m.replace(/\s+/g, "");
        if ( (! partial) && (! this.moves().includes(m)) ) {
            throw new UserFacingError("MOVES_INVALID", i18next.t("apgames:MOVES_INVALID", {move: m}));
        }

        this.results = [];
        if (m === "pass") {
            this.results.push({type: "pass"});
        } else {
            const cell = m.slice(0, 2);
            const piece = m[2];
            let player: playerid = 1;
            if (piece === "b") {
                player = 2;
            }
            this.board.set(cell, player);
            if (player === this.currplayer) {
                this.results.push({type: "place", what: "mine", where: cell});
            } else {
                this.results.push({type: "place", what: "theirs", where: cell});
            }
        }

        if (partial) { return this; }

        // update currplayer
        this.lastmove = m;
        let newplayer = (this.currplayer as number) + 1;
        if (newplayer > this.numplayers) {
            newplayer = 1;
        }
        this.currplayer = newplayer as playerid;

        this.checkEOG();
        this.saveState();
        return this;
    }

    protected checkEOG(): ManalathGame {
        let prevPlayer: playerid = 1;
        if (this.currplayer === 1) {
            prevPlayer = 2;
        }
        // If this move was a pass, and the previous move was a pass, we have a draw
        if ( (this.lastmove === "pass") && (this.stack[this.stack.length - 1].lastmove === "pass") ) {
            this.gameover = true;
            this.winner = [1, 2];
        } else {
            // Get a list of all groups belonging to the previous player
            const groups = this.getGroups(prevPlayer);
            // Extract the one that includes the most recent move (if such a group exists)
            const lastcell = this.lastmove!.slice(0, 2);
            const current = groups.find(g => g.has(lastcell));
            // Then isolate all the others
            const others = groups.filter(g => ! g.has(lastcell));
            // If any of the `others` groups have a quart or quint, that trumps anything the player just built (there will never be both)
            if (others.filter(g => g.size === 4).length > 0) {
                this.gameover = true;
                this.winner = [this.currplayer];
            } else if (others.filter(g => g.size === 5).length > 0) {
                this.gameover = true;
                this.winner = [prevPlayer];
            }
            // Otherwise, see if they made a winning/losing move just now
            if ( (! this.gameover) && (current !== undefined) ) {
                if (current.size === 4) {
                    this.gameover = true;
                    this.winner = [this.currplayer];
                } else if (current.size === 5) {
                    this.gameover = true;
                    this.winner = [prevPlayer];
                }
            }
        }
        if (this.gameover) {
            this.results.push(
                {type: "eog"},
                {type: "winners", players: [...this.winner]}
            );
        }

        return this;
    }

    private getGroups(player: playerid): Set<string>[] {
        const groups: Set<string>[] = [];
        const pieces = [...this.board.entries()].filter(e => e[1] === player).map(e => e[0]);
        const seen: Set<string> = new Set();
        for (const piece of pieces) {
            if (seen.has(piece)) {
                continue;
            }
            const group: Set<string> = new Set();
            const todo: string[] = [piece]
            while (todo.length > 0) {
                const cell = todo.pop()!;
                if (seen.has(cell)) {
                    continue;
                }
                group.add(cell);
                seen.add(cell);
                const neighbours = this.graph.neighbours(cell);
                for (const n of neighbours) {
                    if (pieces.includes(n)) {
                        todo.push(n);
                    }
                }
            }
            groups.push(group);
        }
        return groups;
    }

    public resign(player: playerid): ManalathGame {
        this.gameover = true;
        if (player === 1) {
            this.winner = [2];
        } else {
            this.winner = [1];
        }
        this.results = [
            {type: "resigned", player},
            {type: "eog"},
            {type: "winners", players: [...this.winner]}
        ];
        this.saveState();
        return this;
    }

    public state(): IManalathState {
        return {
            game: ManalathGame.gameinfo.uid,
            numplayers: this.numplayers,
            variants: this.variants,
            gameover: this.gameover,
            winner: [...this.winner],
            stack: [...this.stack]
        };
    }

    public moveState(): IMoveState {
        return {
            _version: ManalathGame.gameinfo.version,
            _results: [...this.results],
            currplayer: this.currplayer,
            lastmove: this.lastmove,
            board: new Map(this.board),
        };
    }

    public render(): APRenderRep {
        // Build piece string
        const pstr: string[][] = [];
        const cells = this.graph.listCells(true);
        for (const row of cells) {
            const pieces: string[] = [];
            for (const cell of row) {
                if (this.board.has(cell)) {
                    const owner = this.board.get(cell)!;
                    if (owner === 1) {
                        pieces.push("A")
                    } else {
                        pieces.push("B");
                    }
                } else {
                    pieces.push("-");
                }
            }
            pstr.push(pieces);
        }

        // Build rep
        const rep: APRenderRep =  {
            board: {
                style: "hex-of-hex",
                minWidth: 5,
                maxWidth: 9,
            },
            legend: {
                A: {
                    name: "piece",
                    player: 1
                },
                B: {
                    name: "piece",
                    player: 2
                },
            },
            pieces: pstr.map(p => p.join("")).join("\n")
        };

        // Add annotations
        if (this.stack[this.stack.length - 1]._results.length > 0) {
            // @ts-ignore
            rep.annotations = [];
            for (const move of this.stack[this.stack.length - 1]._results) {
                if (move.type === "place") {
                    const [x, y] = this.graph.algebraic2coords(move.where!);
                    rep.annotations!.push({type: "enter", targets: [{row: y, col: x}]});
                }
            }
            if (rep.annotations!.length === 0) {
                delete rep.annotations;
            }
        }

        return rep;
    }

    public status(): string {
        let status = super.status();

        if (this.variants !== undefined) {
            status += "**Variants**: " + this.variants.join(", ") + "\n\n";
        }

        return status;
    }

    protected getVariants(): string[] | undefined {
        if ( (this.variants === undefined) || (this.variants.length === 0) ) {
            return undefined;
        }
        const vars: string[] = [];
        for (const v of this.variants) {
            for (const rec of ManalathGame.gameinfo.variants!) {
                if (v === rec.uid) {
                    vars.push(rec.name);
                    break;
                }
            }
        }
        return vars;
    }

    protected getMoveList(): any[] {
        return this.getMovesAndResults(["move", "place"]);
    }

    public chatLog(players: string[]): string[][] {
        // eog, resign, winners, place, move
        const result: string[][] = [];
        for (const state of this.stack) {
            if ( (state._results !== undefined) && (state._results.length > 0) ) {
                const node: string[] = [];
                let otherPlayer = state.currplayer + 1;
                if (otherPlayer > this.numplayers) {
                    otherPlayer = 1;
                }
                let name: string = `Player ${otherPlayer}`;
                if (otherPlayer <= players.length) {
                    name = players[otherPlayer - 1];
                }
                for (const r of state._results) {
                    switch (r.type) {
                        case "place":
                            if (r.what === "mine") {
                                node.push(i18next.t("apresults:PLACE.mine", {player: name, where: r.where}));
                            } else {
                                node.push(i18next.t("apresults:PLACE.theirs", {player: name, where: r.where}));
                            }
                            break;
                        case "eog":
                            node.push(i18next.t("apresults:EOG"));
                            break;
                            case "resigned":
                                let rname = `Player ${r.player}`;
                                if (r.player <= players.length) {
                                    rname = players[r.player - 1]
                                }
                                node.push(i18next.t("apresults:RESIGN", {player: rname}));
                                break;
                            case "winners":
                                const names: string[] = [];
                                for (const w of r.players) {
                                    if (w <= players.length) {
                                        names.push(players[w - 1]);
                                    } else {
                                        names.push(`Player ${w}`);
                                    }
                                }
                                node.push(i18next.t("apresults:WINNERS", {count: r.players.length, winners: names.join(", ")}));
                                break;
                        }
                }
                result.push(node);
            }
        }
        return result;
    }

    public clone(): ManalathGame {
        return new ManalathGame(this.serialize());
    }
}
