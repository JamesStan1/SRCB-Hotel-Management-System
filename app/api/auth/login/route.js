import pool from "../../../lib/db";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    console.log("Login attempt:", { email });

    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    console.log("DB result:", result.rows.length > 0 ? "User found" : "No user found");

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Incorrect Username" }, { status: 401 });
    }

    const user = result.rows[0];
    console.log("User from DB:", { id: user.id, email: user.email, role: user.role });

    let isPasswordValid;
    if (user.password.startsWith("$2b$")) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // TODO: Remove plaintext password support for security
      console.warn("Plaintext password detected for user:", user.email);
      isPasswordValid = user.password === password;
    }
    console.log("Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Incorrect Password" }, { status: 401 });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      throw new Error("Server configuration error");
    }

    // Generate token using only user ID and role
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password;
  return NextResponse.json({ user, token }, { status: 200 });
  } catch (error) {
    console.error("Login API Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
