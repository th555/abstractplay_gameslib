// import { IGame } from "./IGame";
import { GameBase } from "./_base";
import { APGamesInformation } from "../schemas/gameinfo";
import { APRenderRep } from "@abstractplay/renderer/src/schema";
import { RectGrid } from "../common";
import { Directions } from "../common";

const gameDesc:string = `# Cannon

A two-player game played on a 10x10 board. Soldiers can move independently, but three soldiers in a row form a "cannon" and can move along their length or kill soldiers two or three spaces away. The first player to capture the opposing town wins.
`;

type playerid = 1|2;
type pieceid = "s" | "t";
type CellContents = [playerid, pieceid];
const alldirs: Directions[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const homes: Map<playerid, string[]> = new Map([
    [1, ["b1", "c1", "d1", "e1", "f1", "g1", "h1", "i1"]],
    [2, ["b10", "c10", "d10", "e10", "f10", "g10", "h10", "i10"]],
]);

export interface ICannonState {
    currplayer: playerid;
    board: Map<string, CellContents>;
    lastmove?: string;
    gameover: boolean;
    winner: playerid[];
    placed: boolean;
};

const dirsForward: Map<playerid, Directions[]> = new Map([
    [1, ["N", "NW", "NE"]],
    [2, ["S", "SE", "SW"]]
]);
const dirsBackward: Map<playerid, Directions[]> = new Map([
    [1, ["S", "SE", "SW"]],
    [2, ["N", "NW", "NE"]]
]);

export class CannonGame extends GameBase implements ICannonState {
    public static readonly gameinfo: APGamesInformation = {
        name: "Cannon",
        uid: "cannon",
        playercounts: [2],
        version: "20211010",
        description: gameDesc,
        urls: [
            "https://nestorgames.com/rulebooks/CANNON_EN.pdf",
            "http://superdupergames.org/rules/cannon.pdf",
            "https://boardgamegeek.com/boardgame/8553/cannon"
        ],
        people: [
            {
                type: "designer",
                name: "David E. Whitcher"
            }
        ]
    };
    public static coords2algebraic(x: number, y: number): string {
        return GameBase.coords2algebraic(x, y, 10);
    }
    public static algebraic2coords(cell: string): [number, number] {
        return GameBase.algebraic2coords(cell, 10);
    }

    public numplayers: number = 2;
    public currplayer: playerid;
    public board: Map<string, CellContents>;
    public lastmove?: string;
    public gameover: boolean = false;
    public winner: playerid[] = [];
    public placed: boolean = false;

    constructor(state?: ICannonState) {
        super();
        if (state !== undefined) {
            this.currplayer = state.currplayer;
            this.board = new Map(state.board);
            this.lastmove = state.lastmove;
            this.gameover = state.gameover;
            this.winner = [...state.winner];
            this.placed = state.placed;
        } else {
            this.currplayer = 1;
            this.board = new Map([
                ["a2", [1, "s"]],
                ["a3", [1, "s"]],
                ["a4", [1, "s"]],
                ["c2", [1, "s"]],
                ["c3", [1, "s"]],
                ["c4", [1, "s"]],
                ["e2", [1, "s"]],
                ["e3", [1, "s"]],
                ["e4", [1, "s"]],
                ["g2", [1, "s"]],
                ["g3", [1, "s"]],
                ["g4", [1, "s"]],
                ["i2", [1, "s"]],
                ["i3", [1, "s"]],
                ["i4", [1, "s"]],
                ["b7", [2, "s"]],
                ["b8", [2, "s"]],
                ["b9", [2, "s"]],
                ["d7", [2, "s"]],
                ["d8", [2, "s"]],
                ["d9", [2, "s"]],
                ["f7", [2, "s"]],
                ["f8", [2, "s"]],
                ["f9", [2, "s"]],
                ["h7", [2, "s"]],
                ["h8", [2, "s"]],
                ["h9", [2, "s"]],
                ["j7", [2, "s"]],
                ["j8", [2, "s"]],
                ["j9", [2, "s"]],
            ]);
        }
    }

    public moves(player?: 1|2): string[] {
        if (player === undefined) {
            player = this.currplayer;
        }
        if (this.gameover) { return []; }
        const moves: string[] = []
        if (! this.placed) {
            const myhomes = homes.get(player);
            if (myhomes === undefined) {
                throw new Error("Malformed homes. This should never happen.");
            }
            moves.push(...myhomes);
        } else {
            const grid = new RectGrid(10, 10);
            // individual pieces first
            this.board.forEach((v, k) => {
                if ( (v[0] === player) && (v[1] === "s") ) {
                    const currCell = CannonGame.algebraic2coords(k);
                    // forward motion
                    const dirs = dirsForward.get(player);
                    if (dirs === undefined) {
                        throw new Error("Malformed directions. This should never happen.");
                    }
                    dirs.forEach((d) => {
                        const [x, y] = RectGrid.move(...currCell, d);
                        if (grid.inBounds(x, y)) {
                            const cellNext = CannonGame.coords2algebraic(x, y);
                            if (! this.board.has(cellNext)) {
                                moves.push(`${k}-${cellNext}`);
                            }
                        }
                    });

                    // captures
                    const capdirs = [...dirs, "E" as Directions, "W" as Directions];
                    capdirs.forEach((d) => {
                        const [x, y] = RectGrid.move(...currCell, d);
                        if (grid.inBounds(x, y)) {
                            const cellNext = CannonGame.coords2algebraic(x, y);
                            if (grid.inBounds(x, y)) {
                                const contents = this.board.get(cellNext);
                                if ( (contents !== undefined) && (contents[0] !== player) ) {
                                    moves.push(`${k}x${cellNext}`);
                                }
                            }
                        }
                    });

                    // retreats
                    const adjs = grid.adjacencies(...currCell);
                    for (const pair of adjs) {
                        const cellNext = CannonGame.coords2algebraic(...pair);
                        if (this.board.has(cellNext)) {
                            const contents = this.board.get(cellNext);
                            if ( (contents !== undefined) && (contents[0] !== player) ) {
                                const back = dirsBackward.get(player);
                                if (back === undefined) {
                                    throw new Error("Malformed directions. This should never happen.");
                                }
                                for (const d of back) {
                                    const ray = grid.ray(...currCell, d);
                                    if (ray.length >= 1) {
                                        const cellRetreat = CannonGame.coords2algebraic(...ray[0]);
                                        if (this.board.has(cellRetreat)) {
                                            continue;
                                        }
                                        moves.push(`${k}-${cellRetreat}`);
                                    }
                                    if (ray.length >= 2) {
                                        const cellRetreat = CannonGame.coords2algebraic(...ray[1]);
                                        if (! this.board.has(cellRetreat)) {
                                            moves.push(`${k}-${cellRetreat}`);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Check if this piece is the tail of a cannon
                    for (const dir of alldirs) {
                        const ray = grid.ray(...currCell, dir);
                        if (ray.length >= 3) {
                            const raycells = ray.slice(0, 3).map((pair) => {
                                return CannonGame.coords2algebraic(...pair);
                            });
                            if ( (this.board.has(raycells[0])) && (this.board.has(raycells[1])) && (! this.board.has(raycells[2])) ) {
                                const c1 = this.board.get(raycells[0]);
                                const c2 = this.board.get(raycells[1]);
                                if ( (c1 === undefined) || (c2 === undefined) ) {
                                    throw new Error("Invalid cell contents. This should never happen.");
                                }
                                if ( (c1[0] === player) && (c1[1] === "s") && (c2[0] === player) && (c2[1] === "s") ) {
                                    // Move this piece into the empty space
                                    moves.push(`${k}-${raycells[2]}`);

                                    // Capture an enemy piece 2 or 3 spaces away
                                    if (ray.length >= 4) {
                                        const cap = CannonGame.coords2algebraic(...ray[3]);
                                        if (this.board.has(cap)) {
                                            const contents = this.board.get(cap);
                                            if ( (contents !== undefined) && (contents[0] !== player) ) {
                                                moves.push(`x${cap}`);
                                            }
                                        }
                                    }
                                    if (ray.length >= 5) {
                                        const cap = CannonGame.coords2algebraic(...ray[4]);
                                        if (this.board.has(cap)) {
                                            const contents = this.board.get(cap);
                                            if ( (contents !== undefined) && (contents[0] !== player) ) {
                                                moves.push(`x${cap}`);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        return moves;
    }

    public randomMove(): string {
        const moves = this.moves();
        return moves[Math.floor(Math.random() * moves.length)];
    }

    public move(m: string): CannonGame {
        if (! this.moves().includes(m)) {
            throw new Error(`Invalid move ${m}`);
        }
        this.lastmove = m;
        if (m[0] === "x") {
            const cell = m.slice(1);
            this.board.delete(cell);
        } else if ( (m.includes("-")) || (m.includes("x")) ) {
            const cells: string[] = m.split(new RegExp('[\-x]'));
            this.board.set(cells[1], this.board.get(cells[0])!);
            this.board.delete(cells[0]);
        } else {
            this.board.set(m, [this.currplayer, "t"]);
            if (this.currplayer === 2) {
                this.placed = true;
            }
        }
        if (this.currplayer === 1) {
            this.currplayer = 2;
        } else {
            this.currplayer = 1;
        }
        return this.checkEOG();
    }

    public checkEOG(): CannonGame {
        // First check for eliminated town
        if (this.placed) {
            const towns: playerid[] = [];
            for (const contents of this.board.values()) {
                if (contents[1] === "t") {
                    towns.push(contents[0]);
                }
            }
            if (towns.length < 2) {
                this.gameover = true;
                this.winner = [...towns];
            }
        }

        // If still not game over, see if there are no moves available
        if (! this.gameover) {
            if (this.moves().length === 0) {
                this.gameover = true;
                if (this.currplayer === 1) {
                    this.winner = [2];
                } else {
                    this.winner = [1];
                }
            }
        }

        return this;
    }

    public resign(player: 1|2): CannonGame {
        this.gameover = true;
        if (player === 1) {
            this.winner = [2];
        } else {
            this.winner = [1];
        }
        return this;
    }

    public state(): ICannonState {
        return {
            currplayer: this.currplayer,
            lastmove: this.lastmove,
            board: new Map(this.board),
            gameover: this.gameover,
            winner: [...this.winner],
            placed: this.placed
        };
    }

    public render(): APRenderRep {
        // Build piece string
        let pstr: string = "";
        for (let row = 0; row < 10; row++) {
            if (pstr.length > 0) {
                pstr += "\n";
            }
            for (let col = 0; col < 10; col++) {
                const cell = CannonGame.coords2algebraic(col, row);
                if (this.board.has(cell)) {
                    const contents = this.board.get(cell);
                    if (contents === undefined) {
                        throw new Error("Malformed board contents. This should never happen.");
                    }
                    if (contents[0] === 1) {
                        if (contents[1] === "s") {
                            pstr += "A";
                        } else {
                            pstr += "B";
                        }
                    } else if (contents[0] === 2) {
                        if (contents[1] === "s") {
                            pstr += "Y";
                        } else {
                            pstr += "Z";
                        }
                    } else {
                        throw new Error("Unrecognized cell contents. This should never happen.");
                    }
                } else {
                    pstr += "-";
                }
            }
        }
        pstr = pstr.replace(/\-{10}/g, "_");

        // Build rep
        const rep: APRenderRep =  {
            board: {
                style: "squares-checkered",
                width: 10,
                height: 10
            },
            legend: {
                A: [
                    {
                        name: "piece",
                        player: 1
                    },
                    {
                        name: "cannon-piece",
                        scale: 0.5
                    }
                ],
                B: [
                    {
                        name: "piece-square",
                        player: 1
                    },
                    {
                        name: "cannon-town",
                        scale: 0.75
                    }
                ],
                Y: [
                    {
                        name: "piece",
                        player: 2
                    },
                    {
                        name: "cannon-piece",
                        scale: 0.5,
                        rotate: 180
                    }
                ],
                Z: [
                    {
                        name: "piece-square",
                        player: 2
                    },
                    {
                        name: "cannon-town",
                        scale: 0.75,
                        rotate: 180
                    }
                ],
            },
            pieces: pstr
        };

        // Add annotations
        if (this.lastmove !== undefined) {
            // town placement
            if ( (this.lastmove.indexOf("-") < 0) && (this.lastmove.indexOf("x") < 0) ) {
                const [x, y] = CannonGame.algebraic2coords(this.lastmove);
                rep.annotations = [
                    {
                        type: "enter",
                        targets: [
                            {col: x, row: y}
                        ]
                    }
                ];
            // cannon fire
            } else if (this.lastmove[0] === "x") {
                const cell = this.lastmove.slice(1);
                const [x, y] = CannonGame.algebraic2coords(cell);
                rep.annotations = [
                    {
                        type: "exit",
                        targets: [
                            {col: x, row: y}
                        ]
                    }
                ];
            // movement
            } else  {
                const cells: string[] = this.lastmove.split(new RegExp('[\-x]'));
                const [xFrom, yFrom] = CannonGame.algebraic2coords(cells[0]);
                const [xTo, yTo] = CannonGame.algebraic2coords(cells[1]);
                rep.annotations = [
                    {
                        type: "move",
                        targets: [
                            {col: xFrom, row: yFrom},
                            {col: xTo, row: yTo}
                        ]
                    }
                ];
                // If a capture happened to, add the `exit` annotation
                if (this.lastmove.includes("x")) {
                    rep.annotations.push({
                        type: "exit",
                        targets: [
                            {col: xTo, row: yTo}
                        ]
                    });
                }
            }
        }

        return rep;
    }

    public status(): string {
        let ret = "";
        // ret += this.moves().join(", ") + "\n\n";
        if (this.gameover) {
            ret += "**GAME OVER**\n\n"
            ret += "Winner: " + this.winner.join(", ");
        }
        return ret;
    }
}
