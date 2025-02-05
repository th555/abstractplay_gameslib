/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";
import { YavalathGame } from '../../src/games';

describe("Yavalath", () => {
    it ("Three loses", () => {
        let g = new YavalathGame(2);
        g.board.set("e1", 1);
        g.board.set("e2", 1);
        g.move("e3");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([2]);

        g = new YavalathGame(2);
        g.board.set("i1", 1);
        g.board.set("h2", 1);
        g.move("g3");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([2]);

        g = new YavalathGame(2);
        g.board.set("i1", 1);
        g.board.set("h1", 1);
        g.move("g1");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([2]);
    });
    it ("Four wins", () => {
        let g = new YavalathGame(2);
        g.board.set("e1", 1);
        g.board.set("e2", 1);
        g.board.set("e4", 1);
        g.move("e3");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([1]);

        g = new YavalathGame(2);
        g.board.set("i1", 1);
        g.board.set("h2", 1);
        g.board.set("f4", 1);
        g.move("g3");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([1]);

        g = new YavalathGame(2);
        g.board.set("i1", 1);
        g.board.set("h1", 1);
        g.board.set("f1", 1);
        g.move("g1");
        expect(g.gameover).to.be.true;
        expect(g.winner).to.have.members([1]);
    });
    it ("3P must block", () => {
        const g = new YavalathGame(3);
        g.board.set("e1", 2);
        g.board.set("e2", 2);
        g.board.set("e4", 2);
        const bad = g.validateMove("a1");
        expect(bad.valid).to.be.false;
        const good = g.validateMove("e3");
        expect(good.valid).to.be.true;
        expect(good.complete).to.equal(1);
    });
});

