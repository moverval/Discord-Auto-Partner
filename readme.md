# Discord Partner Manager

This Bot manages partner requests, checks if the partnership is valid and when not removes them from the partner list.

# How to run this bot?

First of all, the bot needs some information. For that it needs a ``.env`` environment file.
Then it needs variables that say how the bot can host itself. They need all to be set!


| Name                                | What needs to be inserted                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| CLIENT_SECRET                       | The Bot secret from Discord                                                   |
| CLIENT_INVOKE                       | The command prefix for this bot                                               |
| CLIENT_INVITE                       | An invite link for your bot                                                   |
| MAIN_GUILD                          | The guild's id, the bot runs for                                              |
| MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED | How many members are required on partner server to add it to the partner list |
| MAIN_GUILD_NAME                     | The guild's name                                                              |


After that you can start the bot with [node](https://nodejs.org/en/). 