"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const client_1 = require("@prisma/client");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const openai_1 = require("openai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const server = (0, fastify_1.default)();
const bot = new node_telegram_bot_api_1.default(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const allowedChatIds = process.env.ALLOWED_CHAT_IDS.split(',').map(Number);
async function isAdmin(userId, chatId) {
    const admin = await prisma.admin.findFirst({
        where: { userId: BigInt(userId), chatId: BigInt(chatId) },
    });
    return !!admin;
}
async function checkBlacklist(message) {
    const blacklist = await prisma.blacklist.findMany();
    return blacklist.some(item => {
        if (item.type === 'word') {
            return message.toLowerCase().includes(item.pattern.toLowerCase());
        }
        else if (item.type === 'regex') {
            const regex = new RegExp(item.pattern, 'i');
            return regex.test(message);
        }
        return false;
    });
}
async function checkOpenAI(message) {
    var _a;
    const prompt = await prisma.prompt.findFirst({ orderBy: { createdAt: 'desc' } });
    const promptText = prompt ? prompt.content : 'Ты модератор чата по дизайну. Определи, является ли сообщение рекламой. Если да, то ответь "ДА", если нет, то ответь "НЕТ".';
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: promptText },
            { role: 'user', content: message },
        ],
        max_tokens: 1,
        n: 1,
        stop: null,
        temperature: 0.5,
    });
    const answer = (_a = response.choices[0].message.content) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    return answer === 'yes';
}
bot.on('message', async (msg) => {
    var _a;
    if (!allowedChatIds.includes(msg.chat.id))
        return;
    const isAdminUser = await isAdmin(msg.from.id, msg.chat.id);
    if (!isAdminUser) {
        const messageText = msg.text || '';
        const isBlacklisted = await checkBlacklist(messageText);
        const isSpam = await checkOpenAI(messageText.slice(0, 20));
        if (isBlacklisted || isSpam) {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
            return;
        }
    }
    if (isAdminUser && ((_a = msg.text) === null || _a === void 0 ? void 0 : _a.startsWith('/'))) {
        const [command, ...args] = msg.text.split(' ');
        switch (command) {
            case '/regex':
            case '/word':
                await handleBlacklistCommand(command.slice(1), args, msg);
                break;
            case '/prompt':
                await handlePromptCommand(args.join(' '), msg);
                break;
            case '/admins':
                await handleAdminsCommand(msg);
                break;
        }
    }
});
async function handleBlacklistCommand(type, args, msg) {
    const [action, ...rest] = args;
    const pattern = rest.join(' ');
    switch (action) {
        case 'add':
            await prisma.blacklist.create({ data: { type, pattern } });
            await bot.sendMessage(msg.chat.id, `Added ${type}: ${pattern}`);
            break;
        case 'remove':
            await prisma.blacklist.deleteMany({ where: { type, pattern } });
            await bot.sendMessage(msg.chat.id, `Removed ${type}: ${pattern}`);
            break;
        case 'view':
            const items = await prisma.blacklist.findMany({ where: { type } });
            const list = items.map(item => item.pattern).join('\n');
            await bot.sendMessage(msg.chat.id, `${type.charAt(0).toUpperCase() + type.slice(1)} list:\n${list}`);
            break;
    }
}
async function handlePromptCommand(newPrompt, msg) {
    if (newPrompt) {
        await prisma.prompt.create({ data: { content: newPrompt } });
        await bot.sendMessage(msg.chat.id, 'Prompt updated.');
    }
    else {
        const prompt = await prisma.prompt.findFirst({ orderBy: { createdAt: 'desc' } });
        await bot.sendMessage(msg.chat.id, `Current prompt: ${(prompt === null || prompt === void 0 ? void 0 : prompt.content) || 'No prompt set.'}`);
    }
}
async function handleAdminsCommand(msg) {
    const chatAdmins = await bot.getChatAdministrators(msg.chat.id);
    await prisma.admin.deleteMany({ where: { chatId: BigInt(msg.chat.id) } });
    for (const admin of chatAdmins) {
        await prisma.admin.create({
            data: { userId: BigInt(admin.user.id), chatId: BigInt(msg.chat.id) },
        });
    }
    await bot.sendMessage(msg.chat.id, 'Admin list updated.');
}
const start = async () => {
    try {
        await server.listen({ port: 3000 });
        console.log('Server running on http://localhost:3000');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
