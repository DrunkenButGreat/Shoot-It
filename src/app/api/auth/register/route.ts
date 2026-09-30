import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { registerSchema } from "@/lib/validations"
import { createRegisteredUser, RegistrationError } from "@/lib/registration"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, inviteCode } = registerSchema.parse(await request.json())
    const user = await createRegisteredUser({
      email, name, password: await bcrypt.hash(password, 10),
    }, inviteCode)
    return NextResponse.json({ id: user.id }, { status: 201 })
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: error.code }, { status: 403 })
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalidInput" }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "userExists" }, { status: 409 })
    }
    console.error("Registration failed")
    return NextResponse.json({ error: "errorOccurred" }, { status: 500 })
  }
}
