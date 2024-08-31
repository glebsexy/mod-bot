Set up a backend for a telegram bot that would moderate a telegram chat. Every message would first be processed through a blacklist of simple regex and string matches. If the message passes, the 20 words of the message will be sent to openai gpt-mini to check if it contains any spam or restricted topics. Only admins can use bot commands. Bot checks all messages except from admins.

/regex and /word
Blacklist of strings and regex expressions is dynamic and is stored in a mysql database. Admins can add new words to blacklist, remove words and view the list dumped in chat. Same for regex expressions. Commands: 
/regex add 
/regex view
/regex remove
/word add
/word view
/word remove

/prompt
Chatgpt prompt will also be editable by admins using the prompt command. Using this command and typing the new prompt will replace the current prompt. Using this command without a prompt will output current prompt. Current prompt is stored in the database.

/admins
List of admins is also stored in the database and can be updated by running update admins command. This command gets the list of current admins in the chat where this command was called.

Bot works in multiple chats. It is invited to multiple chats with different chat IDs. It only works in the chats that are hardcoded in an array.

If the message matches one of the words or patterns in the blocklist or if chatgpt deems the message spam, delete the message.

Backend technology:
- node
- fastify
- typescript
- prisma
- mysql