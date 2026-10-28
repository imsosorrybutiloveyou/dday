
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const NEIS_API_KEY = defineSecret("NEIS_API_KEY");

const SCHOOL = {
  atpt: "B10",
  code: "7010964",
  grade: "1",
  classNo: "3"
};

function ymd(v) {
  return /^\d{8}$/.test(v || "") ? v : null;
}
function cleanMeal(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\([^)]*\)/g, "")
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);
}

exports.neis = onRequest(
  {
    region: "asia-northeast3",
    secrets: [NEIS_API_KEY],
    cors: true
  },
  async (req, res) => {
    const date = ymd(req.query.date);
    if (!date) return res.status(400).json({error:"date must be YYYYMMDD"});

    const key = NEIS_API_KEY.value();
    const base = "https://open.neis.go.kr/hub/";
    const common = new URLSearchParams({
      KEY: key,
      Type: "json",
      pIndex: "1",
      pSize: "100",
      ATPT_OFCDC_SC_CODE: SCHOOL.atpt,
      SD_SCHUL_CODE: SCHOOL.code
    });

    const year = date.slice(0,4);
    const timetableParams = new URLSearchParams(common);
    timetableParams.set("AY", year);
    timetableParams.set("GRADE", SCHOOL.grade);
    timetableParams.set("CLASS_NM", SCHOOL.classNo);
    timetableParams.set("TI_FROM_YMD", date);
    timetableParams.set("TI_TO_YMD", date);

    const mealParams = new URLSearchParams(common);
    mealParams.set("MLSV_YMD", date);

    try {
      const [tRes, mRes] = await Promise.all([
        fetch(`${base}hisTimetable?${timetableParams}`),
        fetch(`${base}mealServiceDietInfo?${mealParams}`)
      ]);
      const [t, m] = await Promise.all([tRes.json(), mRes.json()]);

      const timetable = (t?.hisTimetable?.[1]?.row || []).map(r => ({
        period: Number(r.PERIO),
        subject: r.ITRT_CNTNT
      }));

      const mealRows = m?.mealServiceDietInfo?.[1]?.row || [];
      const meals = mealRows.flatMap(r => cleanMeal(r.DDISH_NM));

      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
      return res.json({date, timetable, meals});
    } catch (err) {
      console.error(err);
      return res.status(500).json({error:"NEIS request failed"});
    }
  }
);
