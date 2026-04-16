---
name: enterprise-services
description: "Use when the user works on Enterprise Suite, HR, onboarding, grants, legal, or property-oriented dashboard surfaces."
---

# Enterprise Services

Use this skill for the enterprise domain surfaces in Brunella.

## Trigger conditions

- Enterprise Suite
- digital HR
- onboarding
- timesheet
- grants
- law / legal detective
- property / property sales

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`enterprise-suite`, `digital-hr`, `hr-timesheet`, `hr-onboarding`, `grant-hunter`, `law-detective`, `property-visionary`, `property-sales`, `psales-intake`, `psales-research`, `psales-strategy`, `enterprise-analytics`, `intelligence-monitor`)

## Do

- Keep business-domain boundaries explicit.
- Treat personal or business-sensitive data carefully.
- Confirm before mutating records, exports, or operational outputs.
- Route each subdomain to the correct dashboard panel or downstream service.

## Don't

- Mix HR, legal, property, and finance logic without a clear contract.
- Invent new data models when the panel already defines one.
- Hide state changes or approvals from the user.

## Validation

- The correct enterprise panel is selected for the domain.
- Sensitive fields stay within the appropriate boundary.
- Any action that changes records is auditable.
