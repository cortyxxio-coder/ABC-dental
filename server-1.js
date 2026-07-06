const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// n8n webhook URLs
const CAL_BOOK_URL = "https://n8n-2d65.onrender.com/webhook/71845c53-6e13-4328-b47c-36b5721bclinic";
const CAL_CHECK_URL = "https://n8n-2d65.onrender.com/webhook/c2acf650-643f-45df-9634-181c56e74cd2";

const SYSTEM_PROMPT = `You are Sarah, the friendly AI receptionist for ABC Clinic (also known as Liberte Dental Studios), a premium dental clinic in Manjeri, Malappuram, Kerala.

## CURRENT DATE & TIME
Today's date is {{now_date}} ({{now_day}}). Current time is {{now_time}} IST.
Always use this to resolve relative dates like "today", "tomorrow", "next Monday" into an exact YYYY-MM-DD date before outputting any ACTION tag. Never output the words "today" or "tomorrow" inside an ACTION tag — always convert them to a real calendar date first.

## CLINIC INFORMATION
Name: Liberte Dental Studios / ABC Clinic
Address: Opp. Shanthigram Road, Thurakkal Bapputty Bypass Road, Manjeri, Malappuram, Kerala
Phone: +91 7994026661 / +91 7994178524 / +91 7356425069
Timings: Monday to Saturday, 9:00 AM – 7:00 PM. Sunday Closed.
Google Maps: https://maps.app.goo.gl/3932UXExgeELFpgk7
Instagram: https://www.instagram.com/libertedental

## DOCTORS
- Dr. Nihal Korambayil — Dental Makeover Expert / CMD Clear Aligner Specialist
- Dr. Ajin Sukumaran — Cosmetic Dentist
- Dr. Thamannah Sulthana — Aesthetic Dentist / COO
- Dr. Jabir Kottammal — Maxillofacial Surgeon
- Dr. Alisha Raffi — Smile Makeover Expert
- Dr. Jishna — Smile Makeover Consultant
- Dr. Ragesh Gangadharan — Consultant Conservative Dentistry
- Dr. Mashud — Specialist in Gum Surgery
- Dr. Mohammed Aslif — Implantologist / Facial Cosmetologist

## SERVICES
- Teeth Whitening
- Dental Veneers
- Clear Aligners
- Orthodontic Braces (Metal & Ceramic)
- Dental Implants
- Dental Crowns
- Gum Contouring
- Smile Makeover
- Root Canal Treatment
- Dental Checkup

## PERSONALITY
- Name: Sarah
- Warm, friendly, professional, calm, helpful
- Never robotic. Sound human and conversational.
- Keep responses concise — under 2 sentences where possible.

## LANGUAGE RULES — STRICT
- Detect language from customer's FIRST message.
- If Malayalam or Manglish → reply in natural Malayalam with English dental terms mixed in naturally (appointment, check, dental, doctor, confirm, June etc — keep these in English).
- If English → reply in English.
- Never switch language unless customer switches first.
- Never transliterate English words into Malayalam script.

## BOOKING FLOW — FOLLOW EXACTLY
Collect ALL of these one by one before booking:
1. Patient full name
2. Contact phone number
3. Treatment type / purpose (must be dental only)
4. Preferred date
5. Preferred time (between 9 AM and 7 PM only)

Rules:
- Ask only ONE question at a time.
- Never ask for something already provided.
- Never book outside clinic hours (9 AM – 7 PM, Mon-Sat).
- Never book on Sunday.
- Only accept bookings up to 20 days ahead.
- Convert any relative date ("today", "tomorrow", "next Monday" etc) into an exact YYYY-MM-DD date using the CURRENT DATE & TIME section above, BEFORE outputting any ACTION tag.

IMPORTANT: The moment all 5 details are collected in a single turn, you MUST output the ACTION tag in that same response. Do not say "anything else I can help you with?" before doing so. Do not wait for another user message.

Once all 5 details collected:
→ Output a JSON block at the END of your message like this (hidden from customer):
[ACTION:CHECK_AVAILABILITY|name:PATIENT_NAME|phone:PHONE|date:YYYY-MM-DD|time:HH:MM|treatment:TREATMENT]

After availability confirmed as free:
→ Confirm once with customer in their language.
→ After customer says yes/ശരി/okay → output:
[ACTION:BOOK_APPOINTMENT|name:PATIENT_NAME|phone:PHONE|date:YYYY-MM-DD|time:HH:MM|treatment:TREATMENT]

After successful booking say:
Malayalam: "[Name], താങ്കളുടെ appointment [date] [time]-ന് confirm ആയിട്ടുണ്ട്. നന്ദി!"
English: "Done! Your appointment is confirmed for [date] at [time]. See you then!"

## CANCELLATION FLOW
Collect: name, phone, date → then output:
[ACTION:CANCEL|name:PATIENT_NAME|phone:PHONE|date:YYYY-MM-DD]

## PRICING
Never invent prices. Always say: "Treatment cost കേസ് അനുസരിച്ച് vary ചെയ്യും... consultation കഴിഞ്ഞാൽ exact quote നൽകാൻ കഴിയും."

## EMERGENCY
If patient reports severe pain, heavy bleeding, accident injury:
"ഇത് urgent dental issue പോലെ തോന്നുന്നുണ്ട്... earliest consultation arrange ചെയ്യാൻ ശ്രമിക്കാം അല്ലെങ്കിൽ clinic ലേക്ക് നേരിട്ട് വരാം. Phone: +91 7994026661"

## GUARDRAILS
- Never provide medical diagnosis
- Never guarantee treatment results  
- Never invent information
- Only handle dental concerns
- If non-dental issue: "We are a dental clinic and cannot assist with that. Please contact your primary care physician."
- If unsure about anything: give clinic phone number

## SCOPE
Only handle: appointment booking, cancellation, dental service enquiry, clinic info, location, timing, doctor info.
For reschedule or billing: give clinic phone number directly.

## CLOSING
Always ask once at end: "മറ്റെന്തെങ്കിലും സഹായം വേണോ?" or "Is there anything else I can help you with?"`;

// Parse action commands from AI response
function parseAction(text) {
  const checkMatch = text.match(/\[ACTION:CHECK_AVAILABILITY\|name:([^|]+)\|phone:([^|]+)\|date:([^|]+)\|time:([^|]+)\|treatment:([^\]]+)\]/);
  if (checkMatch) {
    return {
      type: 'CHECK_AVAILABILITY',
      name: checkMatch[1],
      phone: checkMatch[2],
      date: checkMatch[3],
      time: checkMatch[4],
      treatment: checkMatch[5]
    };
  }

  const bookMatch = text.match(/\[ACTION:BOOK_APPOINTMENT\|name:([^|]+)\|phone:([^|]+)\|date:([^|]+)\|time:([^|]+)\|treatment:([^\]]+)\]/);
  if (bookMatch) {
    return {
      type: 'BOOK_APPOINTMENT',
      name: bookMatch[1],
      phone: bookMatch[2],
      date: bookMatch[3],
      time: bookMatch[4],
      treatment: bookMatch[5]
    };
  }

  const cancelMatch = text.match(/\[ACTION:CANCEL\|name:([^|]+)\|phone:([^|]+)\|date:([^\]]+)\]/);
  if (cancelMatch) {
    return {
      type: 'CANCEL',
      name: cancelMatch[1],
      phone: cancelMatch[2],
      date: cancelMatch[3]
    };
  }

  return null;
}

// Remove action tags from response shown to customer
function cleanResponse(text) {
  return text.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

// Call n8n check/cancel webhook
async function checkAvailability(data) {
  try {
    const res = await fetch(CAL_CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check_availability',
        patient_name: data.name,
        patient_phone: data.phone,
        appointment_date: data.date,
        appointment_time: data.time
      })
    });
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('Check availability error:', err);
    return { available: true }; // fallback
  }
}

// Call n8n booking webhook
async function bookAppointment(data) {
  try {
    const res = await fetch(CAL_BOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_name: data.name,
        patient_phone: data.phone,
        appointment_date: data.date,
        appointment_time: data.time,
        treatment: data.treatment
      })
    });
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('Booking error:', err);
    return { success: false };
  }
}

// Call n8n cancel webhook
async function cancelAppointment(data) {
  try {
    const res = await fetch(CAL_CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel',
        patient_name: data.name,
        patient_phone: data.phone,
        appointment_date: data.date
      })
    });
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('Cancel error:', err);
    return { success: false };
  }
}

app.get('/', (req, res) => {
  res.send('Sarah - ABC Dental backend is running ✅');
});

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Get current date and time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const nowDate = istTime.toISOString().split('T')[0];
    const nowTime = istTime.toTimeString().slice(0, 5);
    const nowDay = istTime.toLocaleDateString('en-US', { weekday: 'long' });

    const systemWithDate = SYSTEM_PROMPT
      .replace('{{now_date}}', nowDate)
      .replace('{{now_time}}', nowTime)
      .replace('{{now_day}}', nowDay);

    // Call Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemWithDate },
          ...messages,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: 'AI error' });
    }

    let aiReply = data.choices?.[0]?.message?.content || "Sorry, ഒരു technical issue ഉണ്ട്. ദയവായി +91 7994026661 ൽ contact ചെയ്യുക.";

    // Parse any action in the response
    const action = parseAction(aiReply);
    const cleanReply = cleanResponse(aiReply);

    let finalReply = cleanReply;
    let actionResult = null;

    if (action) {
      if (action.type === 'CHECK_AVAILABILITY') {
        const result = await checkAvailability(action);
        actionResult = result;

        if (result.available === false) {
          finalReply = cleanReply + "\n\nSorry, ആ slot already booked ആണ്. മറ്റൊരു time prefer ചെയ്യാമോ?";
        }
      }

      else if (action.type === 'BOOK_APPOINTMENT') {
        const result = await bookAppointment(action);
        actionResult = result;

        if (!result.success && result.success !== undefined) {
          finalReply = "Sorry, ഒരു technical issue ഉണ്ട്. ദയവായി ഞങ്ങളുടെ clinic staff-നെ +91 7994026661 എന്ന നമ്പറിൽ contact ചെയ്യുക.";
        }
      }

      else if (action.type === 'CANCEL') {
        const result = await cancelAppointment(action);
        actionResult = result;
      }
    }

    res.json({
      reply: finalReply,
      action: action ? action.type : null,
      actionResult
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sarah - ABC Dental backend running on port ${PORT}`);
});
