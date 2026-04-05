import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNewUploadEmail, sendStatusChangeEmail, sendNoteAddedEmail } from '@/lib/email';
import { getAllUserEmails } from '@/app/actions/users';
import { UploadStatus } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    const recipients = await getAllUserEmails();

    if (recipients.length === 0) {
      return NextResponse.json({ message: 'No recipients' });
    }

    // Get current user info
    const { data: currentUser } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const uploaderName = currentUser?.display_name || user.email || 'Unknown';

    switch (type) {
      case 'new_upload':
        await sendNewUploadEmail({
          recipients,
          packagingName: data.packagingName,
          packagingId: data.packagingId,
          uploaderName,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'status_change':
        await sendStatusChangeEmail({
          recipients,
          packagingName: data.packagingName,
          packagingId: data.packagingId,
          newStatus: data.newStatus as UploadStatus,
          changedByName: uploaderName,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'note_added':
        await sendNoteAddedEmail({
          recipients,
          packagingName: data.packagingName,
          packagingId: data.packagingId,
          noteText: data.noteText,
          addedByName: uploaderName,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
