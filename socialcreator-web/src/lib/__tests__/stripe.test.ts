/**
 * @jest-environment node
 */

import { PLANS, getPlanData, type PlanKey } from "../stripe";

describe("stripe", () => {
  describe("PLANS", () => {
    it("should have all required plan keys", () => {
      expect(PLANS.starter).toBeDefined();
      expect(PLANS.pro).toBeDefined();
      expect(PLANS.team).toBeDefined();
    });

    it("should have correct pricing structure", () => {
      // Starter: $50/month (5000 cents)
      expect(PLANS.starter.price).toBe(5000);
      expect(PLANS.starter.profiles).toBe(1);

      // Pro: $70/month (7000 cents)
      expect(PLANS.pro.price).toBe(7000);
      expect(PLANS.pro.profiles).toBe(2);

      // Team: $110/month (11000 cents)
      expect(PLANS.team.price).toBe(11000);
      expect(PLANS.team.profiles).toBe(4);
    });

    it("should have add-on pricing", () => {
      expect(PLANS.starter.addOnPrice).toBe(2000); // $20 per additional profile
      expect(PLANS.starter.addOnProfiles).toBe(1);

      expect(PLANS.pro.addOnPrice).toBe(2000);
      expect(PLANS.team.addOnPrice).toBe(2000);
    });

    it("should have features for each plan", () => {
      expect(PLANS.starter.features.length).toBeGreaterThan(0);
      expect(PLANS.pro.features.length).toBeGreaterThan(0);
      expect(PLANS.team.features.length).toBeGreaterThan(0);
    });
  });

  describe("getPlanData", () => {
    it("should return plan data for valid keys", () => {
      expect(getPlanData("starter")).toEqual(PLANS.starter);
      expect(getPlanData("pro")).toEqual(PLANS.pro);
      expect(getPlanData("team")).toEqual(PLANS.team);
    });

    it("should return null for 'free' plan", () => {
      expect(getPlanData("free")).toBeNull();
    });

    it("should return null for invalid keys", () => {
      expect(getPlanData("invalid" as PlanKey)).toBeNull();
      expect(getPlanData("enterprise" as PlanKey)).toBeNull();
    });
  });

  describe("plan hierarchy", () => {
    it("should have increasing benefits from starter to team", () => {
      expect(PLANS.starter.profiles).toBeLessThan(PLANS.pro.profiles);
      expect(PLANS.pro.profiles).toBeLessThan(PLANS.team.profiles);

      expect(PLANS.starter.price).toBeLessThan(PLANS.pro.price);
      expect(PLANS.pro.price).toBeLessThan(PLANS.team.price);
    });

    it("should include team features in higher plans", () => {
      // Team should have all features including team collaboration
      const teamFeatures = PLANS.team.features.join(" ");
      expect(teamFeatures).toContain("Team");
    });

    it("should include video in Pro and Team", () => {
      const proFeatures = PLANS.pro.features.join(" ");
      const teamFeatures = PLANS.team.features.join(" ");

      expect(proFeatures).toContain("Video");
      expect(teamFeatures).toContain("Video");
    });
  });

  describe("billing simulation", () => {
    it("should calculate monthly cost correctly", () => {
      // Starter: 1 profile included, additional at $20
      const starterBase = PLANS.starter.price / 100; // $50
      const additionalProfileCost = PLANS.starter.addOnPrice / 100; // $20

      expect(starterBase).toBe(50);
      expect(additionalProfileCost).toBe(20);

      // Pro: 2 profiles included
      const proBase = PLANS.pro.price / 100; // $70
      expect(proBase).toBe(70);

      // Team: 4 profiles included
      const teamBase = PLANS.team.price / 100; // $110
      expect(teamBase).toBe(110);
    });

    it("should calculate yearly cost", () => {
      const yearlyMultiplier = 12;

      expect(PLANS.starter.price * yearlyMultiplier).toBe(60000); // $600/year
      expect(PLANS.pro.price * yearlyMultiplier).toBe(84000); // $840/year
      expect(PLANS.team.price * yearlyMultiplier).toBe(132000); // $1,320/year
    });
  });
});