import type { ApplicationDetail } from './admissions.types';

// WhatsApp messages the office sends by hand (the button opens WhatsApp with
// the text ready). Same news as the parent's emails. WhatsApp shows *text* in bold.

export interface ParentMessage { key: string; label: string; text: string; recommended?: boolean }

const longDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const slot = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

/** The messages that make sense for this application now; the one for its current step comes first. */
export function parentMessages(a: ApplicationDetail): ParentMessage[] {
    const school = a.schoolName || 'our school';
    const child = `*${a.childName}*`;
    const status = a.statusLink ? `\n\n🔗 Check the status any time:\n${a.statusLink}` : '';
    const sign = `\n\nWarm regards,\n*${school}*`;
    const head = (emoji: string, title: string) => `${emoji} *${title}*\n\nDear Parent,\n`;
    const appNo = `\n\n📄 Application no: *${a.applicationNo}*`;
    const form = a.admissionForm && a.admissionForm.config.enabled ? a.admissionForm : null;
    const formLink = a.statusLink ? a.statusLink.replace('/status/', '/admission-form/') : '';
    const formPending = !!form && form.status === 'PENDING' && !a.outcome && (a.stage === 'SELECTED' || (a.stage === 'ADMITTED' && !a.placed));
    const feeDue = a.stage === 'SELECTED' && !a.outcome && a.offer?.dueOn && !(a.admissionFee && (a.admissionFee as { status?: string }).status);
    const docs = a.documents.filter(d => d.required && !d.seen).map(d => `• ${d.name}`);
    const reason = [...a.events].reverse().find(e => e.action === 'NOT_SELECTED')?.note;

    const out: ParentMessage[] = [];
    const push = (key: string, label: string, text: string) => out.push({ key, label, text });

    if (a.outcome === 'WAITLIST') {
        push('waitlist', 'Waitlist', `${head('⏳', 'Waitlist update')}${child} is on the waitlist for *${a.standardName}*${a.waitlistRank ? ` at number *${a.waitlistRank}*` : ''}. We will message you as soon as a seat is free.${appNo}${status}${sign}`);
    } else if (a.outcome === 'NOT_SELECTED') {
        push('not-selected', 'Not selected', `${head('✉️', 'Admission update')}Thank you for applying for ${child} in *${a.standardName}*. We are sorry, we are not able to offer a seat this time.${reason ? `\n\n*Reason:* ${reason}` : ''}\n\nFor any question, please contact the school office.${appNo}${sign}`);
    } else if (a.outcome === 'LAPSED') {
        push('lapsed', 'Offer expired', `${head('⌛', 'Seat offer expired')}The admission fee for ${child} was not paid by the last date, so the seat offer has expired. Please contact the school office if you still want the seat.${appNo}${sign}`);
    } else if (!a.outcome) {
        if (a.stage === 'ADMITTED') {
            push('admitted', 'Admission confirmed', `${head('🎉', `Welcome to ${school}!`)}${child}'s admission in *${a.standardName}* is confirmed.${a.admissionNo ? `\n🎓 Admission no: *${a.admissionNo}*` : ''}\n\nThe school will share the class, section and the QubeEx app login soon.${status}${sign}`);
        } else if (a.stage === 'SELECTED') {
            const formLine = form ? (form.config.mode === 'ONLINE'
                ? `\n\n📝 Please fill the admission form here:\n${formLink}`
                : '\n\n📝 Please collect the admission form from the school office, fill it and bring it back with the documents.') : '';
            push('selected', 'Selected, pay the fee', `${head('🎉', 'Congratulations!')}${child} has been selected for *${a.standardName}* at ${school}. 🥳${a.offer?.dueOn ? `\n\n💰 Please pay the admission fee by *${longDay(a.offer.dueOn)}*.` : ''}${docs.length ? `\n\n📂 Please bring the originals:\n${docs.join('\n')}` : ''}${formLine}${appNo}${status}${sign}`);
        } else if (a.stage === 'INTERACTION' && a.interaction?.at && !a.interaction.doneAt) {
            push('interaction', 'Interaction slot', `${head('📅', 'Interaction date')}Please come to the school with ${child} for the interaction on:\n\n🗓️ *${slot(a.interaction.at)}*${a.interaction.note ? `\n\n📌 *Note:* ${a.interaction.note}` : ''}${appNo}${status}${sign}`);
        } else if (a.stage !== 'ENQUIRY') {
            push('received', 'Application received', `${head('📝', 'Application received')}We have received ${child}'s application for *${a.standardName}*. We will let you know the next step soon.${appNo}${status}${sign}`);
        }
    }
    if (out[0]) out[0].recommended = true;

    // Reminders, only while they apply.
    if (feeDue && a.offer?.dueOn) push('fee-reminder', 'Fee reminder', `${head('⏰', 'Admission fee reminder')}This is a reminder to pay ${child}'s admission fee by *${longDay(a.offer.dueOn)}*. After that date the seat may go to another child.${appNo}${status}${sign}`);
    if (formPending && form?.config.mode === 'ONLINE' && formLink) push('form-reminder', 'Admission form reminder', `${head('📝', 'Admission form reminder')}Please fill ${child}'s admission form. Most details are already filled from the registration form; it takes a few minutes.\n\n👉 ${formLink}${sign}`);
    if (formPending && form?.config.mode === 'OFFLINE') push('form-reminder', 'Admission form reminder', `${head('📝', 'Admission form reminder')}Please collect ${child}'s admission form from the school office, fill it and bring it back with the documents.${appNo}${sign}`);
    if (a.statusLink) push('status', 'Status link', `Dear Parent,\n\nYou can check ${child}'s admission status here:\n${a.statusLink}${sign}`);
    push('hello', 'Just say hello', `Hello, this is the admissions office of ${school} about ${child}'s application (${a.applicationNo}).`);
    return out;
}
