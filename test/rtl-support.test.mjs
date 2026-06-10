import test from "node:test";
import assert from "node:assert/strict";
import { getTextDirection, isRtlLocale } from "../assets/codex-rtl-support.js";

test("detects RTL scripts", () => {
  assert.equal(getTextDirection("مرحبا بالعالم"), "rtl");
  assert.equal(getTextDirection("שלום עולם"), "rtl");
  assert.equal(getTextDirection("سلام دنیا"), "rtl");
  assert.equal(getTextDirection("123 اردو"), "rtl");
});

test("keeps LTR content LTR", () => {
  assert.equal(getTextDirection("hello مرحبا"), "ltr");
  assert.equal(getTextDirection("Codex"), "ltr");
});

test("leaves neutral content automatic", () => {
  assert.equal(getTextDirection("1234 / ---"), "auto");
  assert.equal(getTextDirection(""), "auto");
});

test("recognizes RTL locales", () => {
  assert.equal(isRtlLocale("ar-SA"), true);
  assert.equal(isRtlLocale("he-IL"), true);
  assert.equal(isRtlLocale("fa_IR"), true);
  assert.equal(isRtlLocale("ur"), true);
  assert.equal(isRtlLocale("en-US"), false);
});
