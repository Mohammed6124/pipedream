const trello = require("https://github.com/PipedreamHQ/pipedream/components/trello/trello.app.js");
const _ = require('lodash')

module.exports = {
  name: "New Cards",
  description: "Emits an event for each new Trello card on a board.",
  version: "0.0.1",
  dedupe: "unique",
  props: {
    trello,
    boardId: { propDefinition: [trello, "boardId"] },
    listIds: { propDefinition: [trello, "listIds", c => ({ boardId: c.boardId })] },
    db: "$.service.db",
    http: "$.interface.http",
  },
  hooks: {
    async activate() {
      let modelId = this.boardId;
      if (!this.boardId) {
        const member = await this.trello.getMember("me")
        modelId = member.id
      }
      const { id } = await this.trello.createHook({
        id: modelId,
        endpoint: this.http.endpoint,
      })
      this.db.set("hookId", id)
      this.db.set("boardId", this.boardId)
      this.db.set("listIds", this.listIds)
    },
    async deactivate() {
      console.log(this.db.get("hookId"))
      await this.trello.deleteHook({
        hookId: this.db.get("hookId"),
      })
    },
  },

  async run(event) {
    this.http.respond({
      status: 200,
    })

    const body = _.get(event, 'body')
    if (body) {
      const eventType = _.get(body, 'action.type');
      const cardId = _.get(body, 'action.data.card.id');
      const boardId = this.db.get("boardId")
      const listIds = this.db.get("listIds")
      let emitEvent = false;
      let card;

      if (eventType && eventType == 'createCard') {
        card = await this.trello.getCard(cardId);
        if (!boardId) emitEvent = true;
        else if (!listIds || (listIds && listIds.length < 1)) emitEvent = true;
        else if (listIds.includes(card.idList))
          emitEvent = true;
      }

      if (emitEvent) {
        this.$emit(card, {
          id: card.id,
          summary: card.name,
          ts: Date.now(),
        })
      }
    }
  },
};