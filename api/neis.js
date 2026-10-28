const SCHOOL = {
  atpt: "B10",
  code: "7010964",
  grade: "1",
  classNo: "3"
};

function validDate(value) {
  return /^\d{8}$/.test(value || "") ? value : null;
}

function cleanMeal(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\([^)]*\)/g, "")
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const date = validDate(req.query.date);
  if (!date) return res.status(400).json({ error: "date must be YYYYMMDD" });

  const key = process.env.NEIS_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "NEIS_API_KEY is not configured on Vercel"
    });
  }

  const base = "https://open.neis.go.kr/hub/";
  const common = new URLSearchParams({
    KEY: key,
    Type: "json",
    pIndex: "1",
    pSize: "100",
    ATPT_OFCDC_SC_CODE: SCHOOL.atpt,
    SD_SCHUL_CODE: SCHOOL.code
  });

  const tt = new URLSearchParams(common);
  tt.set("AY", date.slice(0, 4));
  tt.set("GRADE", SCHOOL.grade);
  tt.set("CLASS_NM", SCHOOL.classNo);
  tt.set("TI_FROM_YMD", date);
  tt.set("TI_TO_YMD", date);

  const meal = new URLSearchParams(common);
  meal.set("MLSV_YMD", date);

  try {
    const [tRes, mRes] = await Promise.all([
      fetch(`${base}hisTimetable?${tt}`),
      fetch(`${base}mealServiceDietInfo?${meal}`)
    ]);

    if (!tRes.ok || !mRes.ok) {
      throw new Error(`NEIS HTTP ${tRes.status}/${mRes.status}`);
    }

    const [t, m] = await Promise.all([tRes.json(), mRes.json()]);

    const timetable = (t?.hisTimetable?.[1]?.row || []).map(r => ({
      period: Number(r.PERIO),
      subject: r.ITRT_CNTNT
    }));

    const meals = (m?.mealServiceDietInfo?.[1]?.row || [])
      .flatMap(r => cleanMeal(r.DDISH_NM));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ date, timetable, meals });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "NEIS request failed" });
  }
}
