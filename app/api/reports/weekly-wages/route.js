import { NextResponse } from "next/server";
import pool from "../../../lib/db"; // adjust path if needed

export async function GET(request) {
  let client;
  try {
    const url = new URL(request.url);
    const periodStart = url.searchParams.get("periodStart");
    const periodEnd = url.searchParams.get("periodEnd");
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const includeZero = (url.searchParams.get("includeZero") || "true") === "true";

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // Load holidays from settings (stored as JSON array under key 'holidays')
    let holidays = [];
    try {
      const sres = await client.query("SELECT value FROM settings WHERE key = $1", ["holidays"]);
      if (sres.rows[0]) {
        try {
          const v = JSON.parse(sres.rows[0].value);
          if (Array.isArray(v)) holidays = v;
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {
      // ignore settings read errors; treat as no holidays
      holidays = [];
    }

    // Aggregate hours, duty_days, minutes_late and holiday-specific hours from attendance,
    // grouped by user. We pass holiday dates as parameter $3 (date[]).
    const q = `
      SELECT
        u.id AS user_id,
        u.name,
        u.role,
        COALESCE(ROUND(SUM(a.hours_worked)::numeric, 2), 0) AS total_hours,
        COALESCE(u.hourly_rate, 0)::numeric(12,2) AS hourly_rate,
        COALESCE(ROUND((COALESCE(SUM(a.hours_worked), 0) * COALESCE(u.hourly_rate, 0))::numeric, 2), 0) AS total_pay,
        COALESCE(SUM(a.duty_days), 0) AS duty_days,
        COALESCE(SUM(a.minutes_late), 0) AS minutes_late,
        COALESCE(ROUND(SUM(CASE WHEN a.date = ANY($3::date[]) THEN COALESCE(a.hours_worked,0) ELSE 0 END)::numeric,2),0) AS holiday_hours
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date BETWEEN $1 AND $2
        AND a.clock_out IS NOT NULL
      GROUP BY u.id, u.name, u.role, u.hourly_rate
      ${includeZero ? "" : "HAVING COALESCE(SUM(a.hours_worked), 0) > 0"}
      ORDER BY u.name ASC
    `;

    const result = await client.query(q, [periodStart, periodEnd, holidays]);
    const rows = result.rows.map((r) => {
      const totalPay = Number(r.total_pay || 0);
      const holidayHours = Number(r.holiday_hours || 0);
      const hourlyRate = Number(r.hourly_rate || 0);
      const holidayMultiplier = 1.3; // 30% extra on top of base hourly rate
      const holidayRate = Number((hourlyRate * holidayMultiplier).toFixed(2));
      const holidayPay = Number((holidayHours * holidayRate).toFixed(2));

      const sssEmployee = (totalPay * 4) / 4; // Monthly salary / 4 = weekly SSS deduction (placeholder)
      const sssEmployer = sssEmployee * 2; // Example: employer contribution is 2x employee

      return {
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        total_hours: Number(r.total_hours || 0),
        hourly_rate: hourlyRate,
        total_pay: totalPay,
        duty_days: Number(r.duty_days || 0),
        minutes_late: Number(r.minutes_late || 0),
        holiday_hours: holidayHours,
        holiday_rate: holidayRate,
        holiday_pay: holidayPay,
        sss_employee: Number(sssEmployee.toFixed(2)),
        sss_employer: Number(sssEmployer.toFixed(2)),
      };
    });

    if (format === "csv") {
      // Build CSV
      const header = [
        "User ID",
        "Name",
        "Role",
        "Total Hours",
        "Hourly Rate",
        "Total Pay",
        "Duty Days",
        "Minutes Late",
        "SSS Employee",
        "SSS Employer",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        const line = [
          r.user_id,
          `"${String(r.name).replace(/"/g, '""')}"`,
          `"${String(r.role || "").replace(/"/g, '""')}"`,
          r.total_hours.toFixed(2),
          r.hourly_rate.toFixed(2),
          r.total_pay.toFixed(2),
          r.duty_days,
          r.minutes_late,
          r.sss_employee.toFixed(2),
          r.sss_employer.toFixed(2),
        ].join(",");
        lines.push(line);
      }
      const csv = lines.join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="weekly_wages_${periodStart}_to_${periodEnd}.csv"`,
        },
      });
    }

    // JSON response with totals as numbers
    const totalSummary = rows.reduce(
      (acc, r) => {
        acc.total_hours += r.total_hours;
        acc.total_pay += r.total_pay;
        acc.duty_days += r.duty_days;
        acc.minutes_late += r.minutes_late;
        acc.sss_employee += r.sss_employee;
        acc.sss_employer += r.sss_employer;
        return acc;
      },
      {
        total_hours: 0,
        total_pay: 0,
        duty_days: 0,
        minutes_late: 0,
        sss_employee: 0,
        sss_employer: 0,
      }
    );

    return NextResponse.json(
      { periodStart, periodEnd, rows, summary: totalSummary },
      { status: 200 }
    );
  } catch (err) {
    console.error("Weekly wages report error:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to generate report", details: err?.message || String(err) },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
