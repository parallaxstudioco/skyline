import { NextResponse } from 'next/server';
import { sessionLocationService } from '@services/SessionLocationService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const location = await sessionLocationService.resolveRequestLocation(request);
    return NextResponse.json({ location });
  } catch (error) {
    console.error('Error in session-location GET route:', error);
    return NextResponse.json({ location: null }, { status: 500 });
  }
}
