// One-off import of the historical "session -> course -> Google Drive
// folder" tables handed over as scanned/typed PDFs (Nov-Dec 2022 through
// Dec-Jan 2025-26 — the 2026 May-June session was already imported earlier
// via the CSV importer). Mirrors importSessionLinksFromCsvAction's matching
// logic (see src/lib/subject-quality.ts matchProgramName) so the same
// course-name variants across years resolve to the same Program, plus a
// handful of hand-resolved special cases the generic matcher can't guess:
//
//  - "<Level> (H) ALL SUBJECTS" rows (Feb-March 2023, Nov-Dec 2022) bundle
//    every Honours subject at that level into one folder — fanned out to
//    every matching Program instead of picking one arbitrarily.
//  - Rows combining "Life Science" and "Physical Science" in one folder are
//    linked to both B.Sc. (Programme) Life Science and B.Sc. (Programme)
//    Physical Science.
//  - A couple of one-off abbreviations ("B.A. (H) SKT", "B.Sc. PHY SC")
//    that fall just under the auto-match confidence bar.
//  - Anything else that doesn't confidently match a real course is filed
//    under "Unsorted (Pending Categorization)" with the original course
//    label as its variant, instead of being silently dropped — visible at
//    /admin/exam-sessions for manual re-homing.
//
// Safe to re-run: every link is upserted on [sessionId, programId, variantLabel].
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { matchProgramName } from "../src/lib/subject-quality";

const prisma = new PrismaClient();

type Row = { course: string; url: string };
type SessionDef = { label: string; order: number; rows: Row[] };

const SESSIONS: SessionDef[] = [
  {
    label: "2025-26 (Dec-Jan) Question Papers",
    order: 90,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1c_9RbWwqeIefLriJEWs9LHjiH0iBLoaf?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1TxebBhtmPvj3cW2wSSIQ3cT8SnWe9aVH?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1RhK_Fy10qqlzpdK612niksRBQT-Qtnzp?usp=sharing" },
      { course: "B.A. (H) Hindi", url: "https://drive.google.com/drive/folders/1ZTRGCJwuf5dEmLqh7dCWAzZeaDt2pNS_?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1ZSeK-OU0rO5wOvFouvYFUfqd_6mbSsf_?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1Lc3KjC_bde859PPLTrFQbvV05q7WkV6E?usp=sharing" },
      { course: "B.A. (H) Sanskrit", url: "https://drive.google.com/drive/folders/1SfdtXvUGd2mNjIH3AUU6mpc9VMz1-5Xg?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/1rbAwPEkqX5DlDgy9sFFPYTNwQPqTzatJ?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1SxUEd1HfjwIMBbXm3Giw9S24XzU7Wsd-?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1yPlCnkY8RGjS0v181khyN61025-FcjB0?usp=sharing" },
      { course: "B.Sc. Prog Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/19-Z_V6ubf2VGFnWSopwqIbAxarSuXu9x?usp=sharing" },
      { course: "B.Sc.Prog. Physical science+Life Science", url: "https://drive.google.com/drive/folders/18810CI-LYijH2cmvQmqCRJ7BiZx6i3Ii?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1Ep5GfWMYrrCguHtzRp6gE4IMXLVbTDnT?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1cbxdd2wFA1o5WxeM41si9Qc0-cKf8azH?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/1AUDc-a2D2-IkxjZTQRiVSvPx6IDbvwcL?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1RX5IRMQulCnkAk6QW-myC_H-tndTGvco?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/1ApWBjdXjhW_q_qy84VC17-GMxIJcQS7J?usp=sharing" },
      { course: "Question papers mix+ Research Methodology", url: "https://drive.google.com/drive/folders/1lMSxqc6gcyXa_W2iLhtc2WM-vKxGEneb?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1XZSGvFkBWgEKX-JaFD0TpGq326HxquuK?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/10Geq-lfxeO87wSnrU3lJyvjh0tCiGNJK?usp=sharing" },
      { course: "ALL VAC", url: "https://drive.google.com/drive/folders/1rYUcQZkCZBRbviXUjlIkOe9SWTyQxw6K?usp=sharing" },
      { course: "All common prog. Group (AEC)", url: "https://drive.google.com/drive/folders/1Ra5hA-sl6ptJl16xv0KSWPuG4LHAhjDV?usp=sharing" },
      { course: "B.A/B.Sc. Prog", url: "https://drive.google.com/drive/folders/1jgZe0WnEQw1p_1g4Y9p042U9MALQbczt?usp=sharing" },
    ],
  },
  {
    label: "2025 (May-June-July) Question Papers",
    order: 80,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1xTXjZMcwng1eKgyinlScId_28-rGHo24?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1j4_6R220GFw00jxL1O9Li7_tUkoT69YT?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1BBAEGGfUhIsmrg67jPeqjX89L55HVYZ8?usp=sharing" },
      { course: "B.A. (H) Hindi", url: "https://drive.google.com/drive/folders/1KZH2QQO0Sd5JlMVc7izon8Qo4Ra6f_xI?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1CU7_Uv8DlAph6V5LaPHrU3h-e6pJCpXu?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1I4_LEnIjrTPf5X5IGLDzsGJB20MchFer?usp=sharing" },
      { course: "B.A. (H) Sanskrit", url: "https://drive.google.com/drive/folders/1aIyrsBdSaAaDBbvqjS5IzjCXutPw_0Wc?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/1CseJe66bcFD-saOa2nOZdI8_smV4fB-E?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/18XF2dar08cQlsMTd-37ZzqiLkotaAm9R?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1C9Ow7ihRpfNOd-lOThzBRVQ0s0HOJ8kL?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/12LdFIn-5ITJ8fNNrcFeNKofAQsSObRCP?usp=sharing" },
      { course: "B.Sc.Prog. Physical science/B.A.", url: "https://drive.google.com/drive/folders/1QzJutFe8sTCHUrJiLekq6tR2RiSOcdmP?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1Sey2Onev-vrf33w1u_q0BjDC1ZuTV-VH?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1s_OHyf1Lr12ELssRYtsPGNhkSKfE2B98?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/1Ri0MxmLbO1FaKTVWsINBXbkRdwxvfxf4?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1iyIP2JFoQHTztTmqafyabApAX6ljGHuo?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/15_NCZLzeS6t6BLvXd3hnb7jslU85nC8G?usp=sharing" },
      { course: "Question papers mix(All dates folder)", url: "https://drive.google.com/drive/folders/1iXvyUDWKN0gwrt_PDWQiTt3_7pB_okhW?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1eX2ae5kVNHNBbNnJC8ALzleAUH879DwE?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1t12BJkOGPKctl1jgaJIybyP4Oz8RhB_u?usp=sharing" },
      { course: "ALL VAC", url: "https://drive.google.com/drive/folders/1xwNB9Fb6aBB-IQqstoo2RLH2lSoFfZk9?usp=sharing" },
      { course: "ALL AEC/AECC", url: "https://drive.google.com/drive/folders/1yGOoBlFjnMgGijDKKMLOrgz5-vmIou15?usp=sharing" },
      { course: "All common prog. Group", url: "https://drive.google.com/drive/folders/1q4hoW7WQA71N0jjAWps2t6h1hLtsriNU?usp=sharing" },
    ],
  },
  {
    label: "2024-25 (Dec-Jan-Feb) Question Papers",
    order: 70,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1TuJALv4AxvxP64_vRgwiJb-QMYPCeXxI?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1PBPwwhFXyWpuAy67HhB4McBuJrTZ_fAv?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1hpFiMywxekxmFJrQimPbaMrVpkwA9xXC?usp=sharing" },
      { course: "B.A. (H) Hindi (Note:- all in one file)", url: "https://drive.google.com/drive/folders/1wuMK3uY3AI3WSOh0c14akdfeG1xBZtl-?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1hSb7NQhUvIeKw4TKACOkK8V9PwoiEs4P?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1jCpWyo3KPfAbgh0t05XAjLRtscDdzSXk?usp=sharing" },
      { course: "B.A. (H) Sanskrit (Note:- all in one file)", url: "https://drive.google.com/drive/folders/1mzorcI2SPIK0ZLrvSYoPtnPtZic0pimM?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/1ucnq3izcHAKCdsAOH9SKoaNUbcjKNS8z?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1RfYgnVG_KooLBpvR_5060o7Jy8cv8FDV?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1orEF6wl2u9sqqKUaFA6D8xPLYTpfQK7S?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1XYoByV8zcXffyZpTX7DIBa7d254r93Lx?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1E4lOBAJkY8bvPxONPTzuTRYj8-72XQau?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1ZZ1WSbdLth4-_iV3kSxHKOeIq1ILMqpq?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/1tzeC3HnYg81pL-WR8pCkAZpRccwqC6ET?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1plXIQnNSW5mfCk8wHEcWA0tAnnO4Ctrd?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/1DamaWE1hoj-gfL-YhcMGBisJ3ZYaiLjb?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1du9e6ttdsgVoQrcDjSZuvyqEXA1cWatO?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/14O31FqLn_n7UBBtxpV0j8nrgIxEQGKoM?usp=sharing" },
      { course: "ALL AEC", url: "https://drive.google.com/drive/folders/1JkGZgpGqEkcbnJFZwLHg2J6S4yk2LiAV?usp=sharing" },
      { course: "ALL VAC", url: "https://drive.google.com/drive/folders/1nWBLjDCAIK71kEcCXO6kaXraiHOpIXp8?usp=sharing" },
      { course: "ALL COMMON GROUP PROGRAMME", url: "https://drive.google.com/drive/folders/1mhOnj9AIfn-8AW7PoZm6cVw8bIQbyIHb?usp=sharing" },
      { course: "B.Sc. PHY SC", url: "https://drive.google.com/drive/folders/14UEwEiRMm1fLxiMfRHwK2qyqfHE-HP3k?usp=sharing" },
    ],
  },
  {
    label: "2024 (May-June-July) Question Papers",
    order: 60,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1SD_CAIiMgtG4CrPZAOU18xSy15XAyAMF?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1GTESu94bzMCAUx35ChjWxv0nnCLOF6zj?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1kzCjVxpztSeSwtV4wsTxeTdKvQ42X2Q9?usp=drive_link" },
      { course: "B.A. (H) Hindi", url: "https://drive.google.com/drive/folders/1tKLqGB30jdMEZRKocdEngOj2Yh1o-yuJ?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1eqMp5raNMbFJtp1asAqBvmVFwtbZps8I?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1S3Q0GlPHDnekE5y3hYGb7VZ2dEKWEK-k?usp=sharing" },
      { course: "B.A. (H) Sanskrit", url: "https://drive.google.com/drive/folders/1pf5qV1p67MrGix554n-Hqh_7ggJOSBSZ?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/1mSPoOWN6rgO3ns8e8Xdw4lEdYOK2RdTY?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1EG-8RQfz9sa1ac0cmC1WOyiSmfmNqEza?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/14JoXr87sbRuTyERnUPtpCTYtHffj47Rb?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1eraN266VDLZauKZNIcLfb2ELJyBrKABj?usp=sharing" },
      { course: "B.Sc.Prog. Physical science", url: "https://drive.google.com/drive/folders/14fKNvx59ZgJqtSxiXX4KosBT4GA_moCI?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1lEiRQKJ121NWFyGcFOzWz7una9peSRn3?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1mLsEyXDR4K_xE4gmtEt9s9GeqK-1atwK?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/1b0mP5XCyxAE3KXCdTXqizLzHCSRio0Tw?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1fnAuckD7UsMEVyLkt5Of0x3iDuJL4U1n?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/19zeRQx5iHqhwB9iRcvP3k9OWiPTr2xw5?usp=sharing" },
      { course: "B.Sc. (H)+Prog.", url: "https://drive.google.com/drive/folders/1S2gBBQH3Za5dCIAifrgVQM8IxKYfD4Iq?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1gJmuA5BvbyFETuZ9a9_75RkhOrH_2BQi?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1k0EOKdIA_M325GZY0_nWr1coqkRiOy8d?usp=sharing" },
      { course: "ALL VAC", url: "https://drive.google.com/drive/folders/1RIWINb7f0oabUQoSamVGBg4HAjeK9uQs?usp=sharing" },
      { course: "ALL AEC/AECC", url: "https://drive.google.com/drive/folders/1rl9Hk_FZr0zWkeHZcS49BSq-G1sXRKw8?usp=sharing" },
    ],
  },
  {
    label: "2023-24 (Dec-Feb) Question Papers",
    order: 50,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/14ry-ib1QZJ5CqqtWHcORED0_ktxqv1bN?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1i2PjJNHgua0eWOlttTW7VaBt8WB60_QN?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1q9GKqglSHmThfhDx4Mw_Q0jXkw7NLllB?usp=sharing" },
      { course: "B.A. (H) Hindi", url: "https://drive.google.com/drive/folders/1A4mFF17dj-HenYlv1vDAKJpUtoP37svS?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1fqiZlsylCTfyXU04wmj0uHiP_WkgmRgP?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1tt55QCre6Y1l6hfgdg4yQfy9Sk8dg5aJ?usp=sharing" },
      { course: "B.A. (H) Sanskrit", url: "https://drive.google.com/drive/folders/1mNKCnkqUHwbFtsNKRJz1UsPKF6omrpQm?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/17KdyKhEiiRgFWhH2oI6GGPGir1cEA4H7?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/17StG8ik60Yc27S11mAoAs8KC2ax9_BDC?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1oUuxGxcXQIN0a7KjyGoRi0ZjiO1EXlKe?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/17KdyKhEiiRgFWhH2oI6GGPGir1cEA4H7?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1f47CDUUe0jJpRzm90FpPhp4isr_W9MCC?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1s2SeMmeIE30QVeD6j59FLcgg8daWXcm6?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/127nxt6VMrLZCaYKAUuKcrnl45-bmZcyR?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1-EoIj20RwlUmtuhcasoRfU9kqpTnbpov?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/1dNCXWqtUQWkF6RJy74NBn0tDgF8h1OqW?usp=sharing" },
      { course: "All DSE", url: "https://drive.google.com/drive/folders/1lS5CPb-iDkbAC17-d1croQ7Ib6Cj3VNR?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1UAa23C3gI4qHmAQktWvBapW7PPCb3wfd?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1mzIpe8rOveThEQhpGxeIatvDCs8Y4u3q?usp=sharing" },
      { course: "ALL AECC", url: "https://drive.google.com/drive/folders/1fhNQSZiOHmEc9Bi-QR3nqfU5bjTL0eTS?usp=sharing" },
      { course: "ALL VAC", url: "https://drive.google.com/drive/folders/1n9VXueZn-HqgZbhdE7f3e98T-DH4zB6I?usp=sharing" },
      { course: "ALL COMMON GROUP PROGRAMME", url: "https://drive.google.com/drive/folders/1duo-SuRvQvxnVOefjVgUHuZgp10Zm1gz?usp=sharing" },
      { course: "ALL AEC", url: "https://drive.google.com/drive/folders/1IeIe9UxJw4GClM-yl6S8dNYCpvSz1CRs?usp=sharing" },
    ],
  },
  {
    label: "2023 (July) Question Papers — 1st Year",
    order: 45,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1kPJxzzb5XmaN7-8vLhZdNWQJ3BpeUBn-?usp=sharing" },
      { course: "B.A. (H) SKT", url: "https://drive.google.com/drive/folders/1BeylN0JaM2kL7py6CIDJRTUcNIF61XM?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1zqUdsjof7KVk3Z9GDiHVs8lE1IMI1aMN?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1t_zfQ3IcrwP3eg53clFPsaMEJMyCMKCf?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1-br57y5TGaLhZHQd57i1fGE_SkeyXIl?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1-_vqr0dJOfLRHUPAZ5koQQ5972agb4fi?usp=sharing" },
      { course: "ALL AECC", url: "https://drive.google.com/drive/folders/1KfNEFyhoSDaK8eIpJ68SV3lsjQUnEWXV?usp=sharing" },
      { course: "ALL VAC (Value added courses)", url: "https://drive.google.com/drive/folders/1HoAGhxF2Qo12-LRMxVZGNoi_9ThTkFJK?usp=sharing" },
      { course: "ALL DSE", url: "https://drive.google.com/drive/folders/13FYtqTuVS3depx1pNCFTWTJck5BTnQ4?usp=sharing" },
    ],
  },
  {
    label: "2023 (May-June) Question Papers — 2nd & 3rd Year",
    order: 40,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) Economics", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) English", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) Hindi", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) History", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) Political Science", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) Sanskrit", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.A. (H) Sociology", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. (H) Botany", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. (H) Chemistry", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. (H) Mathematics", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. (H) Physics", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "B.Sc. (H) Zoology", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1St_-I9xOYNJnT2Iup2BLCXlW3uRoWQJ7?usp=sharing" },
    ],
  },
  {
    label: "2023 (Feb-March) Question Papers — 1st Year",
    order: 30,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1TVRoqpD0tmid9-A3bJHqJmYami7-P6Cy?usp=share_link" },
      { course: "B.A. (H) ALL SUBJECTS", url: "https://drive.google.com/drive/folders/1A8EjSG8mT8s4SDGiPJmzvO_CcTMfgu1?usp=share_link" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1BpzgYBw2uOf19PuW6PnVEyO6hCjWbapn?usp=share_link" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1LLQglg4Bj6ZLGADVpFqS3jC6OaH2d_V?usp=share_link" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1sNpODBUGNY90hVkAqCnAfZu4QbsQFcnI?usp=share_link" },
      { course: "B.Sc. (H) ALL SUBJECTS", url: "https://drive.google.com/drive/folders/1__Z92doKfDPUj64MvMLA8aUq7-4cujsP?usp=share_link" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1FPB_waVthH5RtMLWCZ0ZUdesE3AwQTH?usp=share_link" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1yRawFeMs7PExP_Qw54gWPcdmsIkXyCeB?usp=share_link" },
      { course: "ALL AECC", url: "https://drive.google.com/drive/folders/1XfVRda7Z8P_FAtlATZ1TBpkmvceOnOPg?usp=share_link" },
      { course: "ALL VAC (Value added courses)", url: "https://drive.google.com/drive/folders/1WJdJ56J89PAvWb9gXQyKhRz28WuBjkeQ?usp=share_link" },
    ],
  },
  {
    label: "2022 (Nov-Dec) Question Papers",
    order: 20,
    rows: [
      { course: "B.A. (Programme)", url: "https://drive.google.com/drive/folders/1O9TZnK5SesN9Ac5O5cAZl3itJhIN1UFT?usp=share_link" },
      { course: "B.A. (H) ALL SUBJECTS", url: "https://drive.google.com/drive/folders/1lYc9kbEkTqaGR5L-3lfjFz9Otfl5vMbq?usp=share_link" },
      { course: "B.Com. (Programme)", url: "https://drive.google.com/drive/folders/1wKAock18xfc-8rRs1hQzVjlBQSER-YqD?usp=share_link" },
      { course: "B.Com. (H)", url: "https://drive.google.com/drive/folders/1hEIrIdWDeAlw3bLAEBdXPMNiOknkPdq?usp=share_link" },
      { course: "B.Sc. Life Sciences+PHY SC.", url: "https://drive.google.com/drive/folders/1L9fL7RJiy5Jpm-SG7ShtjJoBlh4xGnJ3?usp=share_link" },
      { course: "B.Sc. (H) ALL SUBJECTS", url: "https://drive.google.com/drive/folders/1Y8a0niZ6hSYwV9r2_gZEidhS48U0CHt0?usp=share_link" },
      { course: "All DSE", url: "https://drive.google.com/drive/folders/1uSi0xvlPLrMoUrFPaa5gRfox7SElDzfp?usp=share_link" },
      { course: "All SEC", url: "https://drive.google.com/drive/folders/1hT6eIJhGoDxYxxpmisecbAg34y_eL-gV?usp=share_link" },
      { course: "ALL GE", url: "https://drive.google.com/drive/folders/1V3JSEd27HLe_0hs00HDdroWlqiD7R2kN?usp=share_link" },
      { course: "ALL AECC", url: "https://drive.google.com/drive/folders/1droU8PSXSV3qlFmWgRrH8jj0GimWOlV?usp=share_link" },
    ],
  },
];

// Hand-resolved overrides for rows the generic matcher can't confidently
// place, keyed by lowercased/whitespace-collapsed course label.
const LABEL_OVERRIDES: Record<string, string[]> = {
  "b.a. (h) skt": ["B.A. (Hons.) Sanskrit"],
  "b.sc. phy sc": ["B.Sc. (Programme) Physical Science"],
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function upsertLink(sessionId: string, programId: string, variantLabel: string, driveUrl: string) {
  await prisma.sessionProgramLink.upsert({
    where: { sessionId_programId_variantLabel: { sessionId, programId, variantLabel } },
    update: { driveUrl },
    create: { sessionId, programId, variantLabel, driveUrl },
  });
}

async function main() {
  const programs = await prisma.program.findMany();
  const byName = new Map(programs.map((p) => [p.name, p]));

  const unsorted = byName.get("Unsorted (Pending Categorization)");
  if (!unsorted) throw new Error('Program "Unsorted (Pending Categorization)" not found.');
  const lifeScience = byName.get("B.Sc. (Programme) Life Science");
  const physicalScience = byName.get("B.Sc. (Programme) Physical Science");
  if (!lifeScience || !physicalScience) throw new Error("B.Sc. Programme Life/Physical Science not found.");

  const baHons = programs.filter((p) => /^B\.A\. \(Hons\.\)/.test(p.name));
  const bscHons = programs.filter((p) => /^B\.Sc\. \(Hons\.\)/.test(p.name));

  let linked = 0;
  let unsortedCount = 0;

  for (const sessionDef of SESSIONS) {
    const session = await prisma.examSession.upsert({
      where: { label: sessionDef.label },
      create: { label: sessionDef.label, order: sessionDef.order },
      update: { order: sessionDef.order },
    });

    let combinedLifePhySeen = false;
    console.log(`\n${sessionDef.label}`);

    for (const row of sessionDef.rows) {
      const label = row.course.trim();
      const url = row.url.trim();
      const key = normalizeKey(label);

      // 1. Hand-resolved overrides.
      const overrideTargets = LABEL_OVERRIDES[key];
      if (overrideTargets) {
        for (const name of overrideTargets) {
          const program = byName.get(name);
          if (!program) { console.warn(`  ! override target missing: ${name}`); continue; }
          await upsertLink(session.id, program.id, "", url);
          linked++;
        }
        console.log(`  [override] ${label} -> ${overrideTargets.join(", ")}`);
        continue;
      }

      // 2. "<Level> (H) ALL SUBJECTS" wildcard rows.
      if (/all subjects/i.test(label)) {
        const targets = /^b\.?\s*a\.?/i.test(label) ? baHons : /^b\.?\s*sc\.?/i.test(label) ? bscHons : [];
        for (const program of targets) {
          await upsertLink(session.id, program.id, "", url);
          linked++;
        }
        console.log(`  [wildcard] ${label} -> ${targets.length} program(s)`);
        continue;
      }

      // 3. Combined Life Science + Physical Science bundle folders.
      const bareLetters = label.toLowerCase().replace(/[^a-z]/g, "");
      if (bareLetters.includes("life") && bareLetters.includes("phy")) {
        const variant = combinedLifePhySeen ? "2" : "";
        combinedLifePhySeen = true;
        await upsertLink(session.id, lifeScience.id, variant, url);
        await upsertLink(session.id, physicalScience.id, variant, url);
        linked += 2;
        console.log(`  [combined] ${label} -> Life Science + Physical Science${variant ? ` (variant ${variant})` : ""}`);
        continue;
      }

      // 4. Generic fuzzy match (same logic the CSV importer uses).
      const { program, confidence, variantLabel } = matchProgramName(programs, label);
      if (program && confidence >= 0.9) {
        await upsertLink(session.id, program.id, variantLabel, url);
        linked++;
        console.log(`  [auto] ${label} -> ${program.name}${variantLabel ? ` (${variantLabel})` : ""}`);
      } else {
        await upsertLink(session.id, unsorted.id, label.slice(0, 60), url);
        unsortedCount++;
        console.log(
          `  [unsorted] ${label} (closest guess: ${program?.name ?? "none"} @ ${confidence.toFixed(2)})`
        );
      }
    }
  }

  // The 2026 (May-June) CSV import auto-matched every row except B.A. (Hons.)
  // Economics (which should have matched at confidence 1) — add it directly.
  const session2026 = await prisma.examSession.findFirst({ where: { label: { contains: "2026" } } });
  const economics = byName.get("B.A. (Hons.) Economics");
  if (session2026 && economics) {
    const existing = await prisma.sessionProgramLink.findUnique({
      where: { sessionId_programId_variantLabel: { sessionId: session2026.id, programId: economics.id, variantLabel: "" } },
    });
    if (!existing) {
      await upsertLink(
        session2026.id,
        economics.id,
        "",
        "https://drive.google.com/drive/folders/1azipCWwOY2gCzg7n13UoUIgSdRdfeH5m?usp=sharing"
      );
      console.log("\nFixed missing B.A. (Hons.) Economics link in the 2026 session.");
    }
  }

  console.log(`\nDone. ${linked} links matched to real courses, ${unsortedCount} filed under Unsorted for review.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
