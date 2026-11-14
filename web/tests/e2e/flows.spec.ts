import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Demo@1234";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL(/\/(doctor|patient)/);
}

test("landing page and TI-RADS calculator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("تشخيص أدق");
  await page.goto("/calculator");
  // Solid + very hypoechoic + taller-than-wide + lobulated + punctate = 13 points → TR5
  await page.getByRole("radio", { name: /منخفضة الصدى جدًا/ }).click();
  await page.getByRole("radio", { name: /أطول من عرضها/ }).click();
  await page.getByRole("radio", { name: /مفصّصة/ }).click();
  await page.getByRole("checkbox", { name: /بؤر نقطية/ }).click();
  await expect(page.getByText("TR5", { exact: true })).toBeVisible();
});

test("wrong password shows an error and does not log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("dr.sara@thyrotrack.demo");
  await page.getByLabel("كلمة المرور").fill("wrong-password");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText("البريد أو كلمة المرور غير صحيحة.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("doctor sees only assigned patients; other doctors' patients are hidden", async ({ page }) => {
  await login(page, "dr.sara@thyrotrack.demo");
  await page.goto("/doctor/patients");
  await expect(page.getByRole("link", { name: "فتح الملف" })).toHaveCount(6);
  await expect(page.getByText("ريم خالد عثمان")).toHaveCount(0); // Dr. Khaled's patient
});

test("patient is kept out of the clinician area", async ({ page }) => {
  await login(page, "patient1@thyrotrack.demo");
  await page.goto("/doctor");
  await expect(page).toHaveURL(/\/patient/);
  await expect(page.getByRole("heading", { name: /أهلًا/ })).toBeVisible();
});

test("doctor reviews an AI result, signs it and sends the report", async ({ page }) => {
  await login(page, "dr.sara@thyrotrack.demo");
  await page.goto("/doctor/studies");
  await page.getByRole("link", { name: "مراجعة" }).first().click();
  await expect(page.getByRole("heading", { name: "مراجعة الطبيب النهائية" })).toBeVisible();

  // Change one feature → decision becomes "modified" and a reason is required
  await page.getByLabel("القرار النهائي: الحواف").selectOption("SMOOTH");
  await expect(page.getByText("تعديل النتيجة")).toBeVisible();
  const sign = page.getByRole("button", { name: "اعتماد وتوقيع التقرير" });
  await expect(sign).toBeDisabled();
  await page.getByPlaceholder("يُحفظ في سجل التدقيق").fill("الحواف ناعمة في المقطع الطولي");
  await sign.click();
  await page.getByRole("dialog").getByRole("button", { name: "وقّع واعتمد" }).click();

  await expect(page.getByRole("heading", { name: "التقرير معتمد" })).toBeVisible();
  await expect(page.getByText(/SHA-256/)).toBeVisible();

  await page.getByRole("button", { name: "إرسال للمريض" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "إرسال" }).click();
  await expect(page.getByText("أُرسل للمريض").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "إرسال للمريض" })).toHaveCount(0);
});

test("doctor adds a patient with a portal account; the patient can log in", async ({ page, browser }) => {
  await login(page, "dr.sara@thyrotrack.demo");
  await page.goto("/doctor/patients");
  await page.getByRole("link", { name: "إضافة مريض" }).click();
  const email = `new.patient.${Date.now()}@thyrotrack.demo`;
  await page.getByLabel("الاسم بالكامل").fill("مريم سامي عبد الله");
  await page.getByLabel("تاريخ الميلاد").fill("1990-05-14");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByRole("button", { name: "حفظ المريض" }).click();
  await expect(page.getByText("تمت إضافة مريم سامي عبد الله")).toBeVisible();
  const password = (await page.locator("dd.font-mono").innerText()).trim();

  // The new patient appears in the doctor's list
  await page.goto("/doctor/patients");
  await expect(page.getByText("مريم سامي عبد الله")).toBeVisible();

  // ...and can log in to the portal with the one-time password
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto("/login");
  await p2.getByLabel("البريد الإلكتروني").fill(email);
  await p2.getByLabel("كلمة المرور").fill(password);
  await p2.getByRole("button", { name: "دخول" }).click();
  await expect(p2).toHaveURL(/\/patient/);
  await expect(p2.getByText("لا توجد نتائج معتمدة بعد")).toBeVisible();
});
