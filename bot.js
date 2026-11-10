const { Telegraf } = require('telegraf');
const http = require('http');

if (!process.env.BOT_TOKEN) {
  console.error('XATO: BOT_TOKEN environment variable qo\'yilmagan');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ====== SHU YERNI O'ZINGIZGA MOSLANG ======
const GREETING =
  "Assalomu alaykum! Hozir band bo'lishim mumkin, tez orada javob beraman. " +
  "Savolingizni yozib qoldiring.";

// kalit so'z -> javob
const KEYWORDS = [
  { words: ['narx', 'qancha', 'necha pul'], reply: "Narxlar haqida: (shu yerga narxlarni yozing)" },
  { words: ['manzil', 'qayerda', 'lokatsiya'], reply: "Manzilimiz: (shu yerga manzilni yozing)" },
  { words: ['ish vaqti', 'soat nechada'], reply: "Ish vaqti: 09:00 – 18:00" },
];

// bir odamga qayta-qayta salom bermaslik (soat)
const GREET_COOLDOWN_HOURS = 12;
// ==========================================

const lastGreet = new Map(); // "connId:chatId" -> vaqt

function pickReply(text) {
  const t = (text || '').toLowerCase();
  for (const k of KEYWORDS) {
    if (k.words.some((w) => t.includes(w))) return { text: k.reply, keyword: true };
  }
  return { text: GREETING, keyword: false };
}

async function handleBusinessMessage(m) {
  const connId = m.business_connection_id;
  if (!connId || !m.chat || !m.from) return;

  // Faqat mijozning xabariga javob beramiz.
  // Shaxsiy chatda mijoz xabarida from.id == chat.id bo'ladi;
  // sizning o'z xabaringizda from.id boshqa bo'ladi.
  if (m.from.id !== m.chat.id) return;
  if (m.from.is_bot) return;

  const { text, keyword } = pickReply(m.text || m.caption);

  const key = connId + ':' + m.chat.id;
  if (!keyword) {
    const last = lastGreet.get(key) || 0;
    if (Date.now() - last < GREET_COOLDOWN_HOURS * 3600 * 1000) return;
  }

  await bot.telegram.callApi('sendMessage', {
    business_connection_id: connId,
    chat_id: m.chat.id,
    text,
  });

  // Salomni faqat muvaffaqiyatli yuborilgandan keyin belgilaymiz
  if (!keyword) lastGreet.set(key, Date.now());
}

bot.use(async (ctx, next) => {
  const u = ctx.update;

  if (u.business_connection) {
    const c = u.business_connection;
    console.log('business_connection:', c.id, 'enabled =', c.is_enabled);
    return;
  }

  if (u.business_message) {
    try {
      await handleBusinessMessage(u.business_message);
    } catch (e) {
      console.error('business_message xato:', e.message);
    }
    return;
  }

  return next();
});

// Botning o'zi bilan oddiy chat
bot.start((ctx) =>
  ctx.reply(
    'Bu bot Telegram Business orqali ishlaydi. ' +
      'Sozlamalar → Business → Chatlarni avtomatlashtirish bo\'limiga ulang.'
  )
);

bot.catch((err) => console.error('Bot xatosi:', err.message));

// Render uchun oddiy server (sog'liq tekshiruvi)
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('ok')).listen(PORT);

bot
  .launch({
    allowedUpdates: ['message', 'business_connection', 'business_message'],
  })
  .catch((e) => {
    console.error('Ishga tushmadi:', e.message);
    process.exit(1);
  });
console.log('Bot ishga tushdi');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
