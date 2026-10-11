import { test } from "node:test";
import assert from "node:assert/strict";
import { searchMatch } from "@/lib/search-match";

test("students' shorthand finds the course", () => {
  const pol = "B.A. (Hons.) Political Science";
  for (const q of ["polscience", "pol science", "political science", "ba hons pol sci", "b.a. pol sc", "BA Honours Political"]) {
    assert.ok(searchMatch(pol, q), q);
  }
  for (const q of ["bcom", "b.com", "b com hons", "bcom honours", "bcomh"]) assert.ok(searchMatch("B.Com. (Hons.)", q), q);
  assert.ok(searchMatch("B.Com (P)", "bcom"));
  assert.ok(searchMatch("Computer Science", "cs"));
  assert.ok(searchMatch("B.A (Prog.) Economics as Major", "ba programme eco"));
});

test("every way DU prints a course name", () => {
  const cases: [string, string][] = [
    ["B. Com (H) Part-III, CBCS", "bcom hons"], // (H) = Hons
    ["B.Com (P)", "bcom programme"], // (P) = Prog
    ["B.Com", "commerce"],
    ["History Honours", "ba hons history"], // no degree printed
    ["Psychology Honours", "psych hons"],
    ["B.A (hons) Socialogy", "sociology"], // DU's typo
    ["Bachelor of Arts (Hons) Geography", "ba geography"],
    ["Bachelor of Management Studies", "bms"],
    ["Bachelor of Business Administration (Financial Investment Analysis)", "bba fia"], // initials
    ["B.A.(Prog.) with Commerce (Human Resource Management)", "hrm"],
    ["B.Tech. Information Technology & Mathematical Innovation", "btech it"],
    ["B.Sc. (Hons.) Physical Education, Health Education & Sports", "pe hons"],
    ["B.Sc. (Hons.) Environmental Science", "evs hons"],
    ["B. Sc. (Hons) Biochemistry", "bio chem"],
  ];
  for (const [course, q] of cases) assert.ok(searchMatch(course, q), `${q} → ${course}`);
  assert.ok(!searchMatch("B.A. (Hons.) Economics", "cs")); // not "economiCS"
});

test("doesn't match unrelated courses", () => {
  assert.ok(!searchMatch("B.A. (Hons.) Political Science", "bcom"));
  assert.ok(!searchMatch("B.A. (Prog) with Political Science as Major Discipline", "ba hons pol"));
  for (const q of ["political science", "polscience", "pol sci"]) assert.ok(!searchMatch("B.Sc. Polymer Science", q), q);
  assert.ok(!searchMatch("Basic Bengali", "ba hons"));
});
