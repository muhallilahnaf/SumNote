
import { describe, expect, it } from "vitest";
import { calculateLine, calculateNote } from "./calculator";

describe("SumNote calculation engine", () => {
  describe("standalone numbers", () => {
    it("recognizes positive and negative amounts", () => {
      expect(calculateLine("Pocket money 200").amount).toBe(200);
      expect(calculateLine("Bread -50").amount).toBe(-50);
      expect(calculateLine("Bonus +25").amount).toBe(25);
    });

    it("uses the last standalone number", () => {
      expect(calculateLine("Bought 2 packs for 50").amount).toBe(50);
    });

    it("accepts trailing units", () => {
      expect(calculateLine("Bread 50 taka").amount).toBe(50);
      expect(calculateLine("Rice 2 x 50 kg").amount).toBe(100);
    });

    it("does not extract numbers embedded in words", () => {
      const result = calculateLine("xbox360 is expensive");

      expect(result.status).toBe("valid");
      expect(result.amount).toBe(0);
    });

    it("treats text without numbers as zero", () => {
      expect(calculateLine("Buy bread tomorrow").amount).toBe(0);
    });

    it("ignores blank lines", () => {
      expect(calculateLine("   ").status).toBe("ignored");
    });
  });

  describe("binary operations", () => {
    it("supports multiplication", () => {
      expect(calculateLine("Rice 2 x 50").amount).toBe(100);
      expect(calculateLine("Rice 2 * 50").amount).toBe(100);
      expect(calculateLine("Rice 2 × 50").amount).toBe(100);
    });

    it("preserves operand signs", () => {
      expect(calculateLine("Item -2 x 50").amount).toBe(-100);
      expect(calculateLine("Item 2 x -50").amount).toBe(-100);
      expect(calculateLine("Item -2 x -50").amount).toBe(100);
    });

    it("supports division", () => {
      expect(calculateLine("Share 100 / 4").amount).toBe(25);
      expect(calculateLine("Share 100 / -4").amount).toBe(-25);
    });

    it("flags division by zero", () => {
      expect(calculateLine("Cost 100 / 0").status).toBe("ambiguous");
    });

    it("flags unsupported addition and subtraction expressions", () => {
      expect(calculateLine("Cost 2 + 3").status).toBe("ambiguous");
      expect(calculateLine("Cost 5 - 2").status).toBe("ambiguous");
    });

    it("flags chained operations", () => {
      expect(calculateLine("Cost 2 x 3 x 4").status).toBe("ambiguous");
    });

    it("flags incomplete operations", () => {
      expect(calculateLine("Bread 2 x").status).toBe("ambiguous");
      expect(calculateLine("Cost 100 /").status).toBe("ambiguous");
      expect(calculateLine("Cost 2 x 50 x").status).toBe("ambiguous");
    });
  });

  describe("dates and decimals", () => {
    it("ignores recognizable dates", () => {
      expect(calculateLine("Meeting 20/10/2026").amount).toBe(0);
      expect(calculateLine("Meeting 2026-10-20").amount).toBe(0);
    });

    it("preserves amounts on lines containing dates", () => {
      expect(calculateLine("Meeting 20/10/2026 cost 50").amount).toBe(50);
    });

    it("calculates decimal amounts", () => {
      expect(calculateLine("Rice 85.50").amount).toBe(85.5);
      expect(calculateLine("Change -0.75").amount).toBe(-0.75);
    });

    it("flags numbers exceeding supported precision", () => {
      expect(calculateLine("Amount 1.1234567").status).toBe("ambiguous");
    });
  });

  describe("note totals", () => {
    it("calculates a remaining balance", () => {
      const result = calculateNote(
        "Pocket money 200\nBread -50\nEggs -100\nChocolate -30"
      );

      expect(result.total).toBe(20);
      expect(result.formattedTotal).toBe("20");
    });

    it("adds positive values", () => {
      const result = calculateNote("Rice 80\nEggs 60\nMilk 90");

      expect(result.total).toBe(230);
      expect(result.formattedTotal).toBe("230");
    });

    it("excludes ambiguous lines from the total", () => {
      const result = calculateNote(
        "Money 200\nCost 2 x 3 x 4\nBread -50"
      );

      expect(result.total).toBe(150);
      expect(result.lines[1].status).toBe("ambiguous");
    });

    it("shows two decimal places when a valid amount is decimal", () => {
      const result = calculateNote("Rice 85.50\nBread 10");

      expect(result.formattedTotal).toBe("95.50");
    });

    it("formats a fractional division result with two decimals", () => {
      const result = calculateNote("Share 5 / 2");

      expect(result.formattedTotal).toBe("2.50");
    });

    it("recalculates after a line is corrected", () => {
      const before = calculateNote("Money 200\nCost 2 x");
      const after = calculateNote("Money 200\nCost 2 x 50");

      expect(before.total).toBe(200);
      expect(after.total).toBe(300);
    });
  });
});
