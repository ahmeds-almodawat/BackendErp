import { getDb } from "../api/queries/connection";
import { companies, branches } from "./schema";

async function seed() {
  const db = getDb();

  const [company] = await db
    .insert(companies)
    .values({
      code: "LOCAL-RESTAURANT-GROUP",
      nameEn: "Restaurant Group Pilot",
      nameAr: "مجموعة مطاعم التجربة",
      currency: "SAR",
      vatRate: "0.15",
    })
    .returning();

  await db.insert(branches).values([
    {
      companyId: company.id,
      code: "MAIN",
      nameEn: "Main Branch",
      nameAr: "الفرع الرئيسي",
    },
  ]);

  console.log("Seed complete.");
}

seed().catch(console.error);
