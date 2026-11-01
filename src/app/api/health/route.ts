import { NextResponse } from 'next/server'
import packageInfo from '../../../../package.json'
const { version } = packageInfo

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version
  })
}
