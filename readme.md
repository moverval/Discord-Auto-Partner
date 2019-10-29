# Discord Partner Manager

This Bot manages partner requests, checks if the partnership is valid and when not removes them from the partner list.

# How to run this bot?

This bot is powered with [node](https://nodejs.org/en/), so [node](https://nodejs.org/en/) should be installed on the machine which should run this.

Use git to clone this project into one folder
```
git clone https://github.com/MMNN321/Discord-Auto-Partner.git
```
and install the packages with
```
npm install
```

The bot needs some information. For that it needs an ``.env`` environment file.
Then it needs variables that say how the bot can host itself. They need all to be set!


| Name                                | What needs to be inserted                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| CLIENT_SECRET                       | The Bot secret from Discord                                                   |
| CLIENT_INVOKE                       | The command prefix for this bot                                               |
| CLIENT_INVITE                       | An invite link for your bot                                                   |
| MAIN_GUILD                          | The guild's id, the bot runs for                                              |
| MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED | How many members are required on partner server to add it to the partner list |
| MAIN_GUILD_NAME                     | The guild's name                                                              |
| PARTNER_CATEGORY                    | The category for the partner channels. It needs the categories name           |

Here is an example
```
CLIENT_SECRET="Your token"
CLIENT_INVOKE="++"
CLIENT_INVITE="https://discordapp.com/api/oauth2/authorize?client_id=638025226168303626&permissions=68608&scope=bot"
MAIN_GUILD="460424836246929409"
MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED=30
MAIN_GUILD_NAME="DeineWerbung"
PARTNER_CATEGORY="Partners"
```

When all variables are set the bot should be startable with
```
node index
```
or
```
npm start
``` 