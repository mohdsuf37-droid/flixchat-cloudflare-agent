var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/partyserver/dist/index.js
import { DurableObject } from "cloudflare:workers";

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.browser.js
var nanoid = /* @__PURE__ */ __name((size = 21) => {
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
}, "nanoid");

// node_modules/partyserver/dist/index.js
if (!("OPEN" in WebSocket)) {
  const WebSocketStatus = {
    // @ts-expect-error
    CONNECTING: WebSocket.READY_STATE_CONNECTING,
    // @ts-expect-error
    OPEN: WebSocket.READY_STATE_OPEN,
    // @ts-expect-error
    CLOSING: WebSocket.READY_STATE_CLOSING,
    // @ts-expect-error
    CLOSED: WebSocket.READY_STATE_CLOSED
  };
  Object.assign(WebSocket, WebSocketStatus);
  Object.assign(WebSocket.prototype, WebSocketStatus);
}
var AttachmentCache = class {
  static {
    __name(this, "AttachmentCache");
  }
  #cache = /* @__PURE__ */ new WeakMap();
  get(ws) {
    let attachment = this.#cache.get(ws);
    if (!attachment) {
      attachment = WebSocket.prototype.deserializeAttachment.call(
        ws
      );
      if (attachment !== void 0) {
        this.#cache.set(ws, attachment);
      } else {
        throw new Error(
          "Missing websocket attachment. This is most likely an issue in PartyServer, please open an issue at https://github.com/threepointone/partyserver/issues"
        );
      }
    }
    return attachment;
  }
  set(ws, attachment) {
    this.#cache.set(ws, attachment);
    WebSocket.prototype.serializeAttachment.call(ws, attachment);
  }
};
var attachments = new AttachmentCache();
var connections = /* @__PURE__ */ new WeakSet();
var isWrapped = /* @__PURE__ */ __name((ws) => {
  return connections.has(ws);
}, "isWrapped");
var createLazyConnection = /* @__PURE__ */ __name((ws) => {
  if (isWrapped(ws)) {
    return ws;
  }
  let initialState = void 0;
  if ("state" in ws) {
    initialState = ws.state;
    delete ws.state;
  }
  const connection = Object.defineProperties(ws, {
    id: {
      get() {
        return attachments.get(ws).__pk.id;
      }
    },
    server: {
      get() {
        return attachments.get(ws).__pk.server;
      }
    },
    socket: {
      get() {
        return ws;
      }
    },
    state: {
      get() {
        return ws.deserializeAttachment();
      }
    },
    setState: {
      value: /* @__PURE__ */ __name(function setState(setState) {
        let state;
        if (setState instanceof Function) {
          state = setState(this.state);
        } else {
          state = setState;
        }
        ws.serializeAttachment(state);
        return state;
      }, "setState")
    },
    deserializeAttachment: {
      value: /* @__PURE__ */ __name(function deserializeAttachment() {
        const attachment = attachments.get(ws);
        return attachment.__user ?? null;
      }, "deserializeAttachment")
    },
    serializeAttachment: {
      value: /* @__PURE__ */ __name(function serializeAttachment(attachment) {
        const setting = {
          ...attachments.get(ws),
          __user: attachment ?? null
        };
        attachments.set(ws, setting);
      }, "serializeAttachment")
    }
  });
  if (initialState) {
    connection.setState(initialState);
  }
  connections.add(connection);
  return connection;
}, "createLazyConnection");
var HibernatingConnectionIterator = class {
  static {
    __name(this, "HibernatingConnectionIterator");
  }
  constructor(state, tag) {
    this.state = state;
    this.tag = tag;
  }
  index = 0;
  sockets;
  [Symbol.iterator]() {
    return this;
  }
  next() {
    const sockets = (
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      this.sockets ?? (this.sockets = this.state.getWebSockets(this.tag))
    );
    let socket;
    while (socket = sockets[this.index++]) {
      if (socket.readyState === WebSocket.READY_STATE_OPEN) {
        const value = createLazyConnection(socket);
        return { done: false, value };
      }
    }
    return { done: true, value: void 0 };
  }
};
var InMemoryConnectionManager = class {
  static {
    __name(this, "InMemoryConnectionManager");
  }
  #connections = /* @__PURE__ */ new Map();
  tags = /* @__PURE__ */ new WeakMap();
  getCount() {
    return this.#connections.size;
  }
  getConnection(id) {
    return this.#connections.get(id);
  }
  *getConnections(tag) {
    if (!tag) {
      yield* this.#connections.values().filter(
        (c) => c.readyState === WebSocket.READY_STATE_OPEN
      );
      return;
    }
    for (const connection of this.#connections.values()) {
      const connectionTags = this.tags.get(connection) ?? [];
      if (connectionTags.includes(tag)) {
        yield connection;
      }
    }
  }
  accept(connection, options) {
    connection.accept();
    this.#connections.set(connection.id, connection);
    this.tags.set(connection, [
      // make sure we have id tag
      connection.id,
      ...options.tags.filter((t) => t !== connection.id)
    ]);
    const removeConnection = /* @__PURE__ */ __name(() => {
      this.#connections.delete(connection.id);
      connection.removeEventListener("close", removeConnection);
      connection.removeEventListener("error", removeConnection);
    }, "removeConnection");
    connection.addEventListener("close", removeConnection);
    connection.addEventListener("error", removeConnection);
    return connection;
  }
};
var HibernatingConnectionManager = class {
  static {
    __name(this, "HibernatingConnectionManager");
  }
  constructor(controller) {
    this.controller = controller;
  }
  getCount() {
    return Number(this.controller.getWebSockets().length);
  }
  getConnection(id) {
    const sockets = this.controller.getWebSockets(id);
    if (sockets.length === 0) return void 0;
    if (sockets.length === 1)
      return createLazyConnection(sockets[0]);
    throw new Error(
      `More than one connection found for id ${id}. Did you mean to use getConnections(tag) instead?`
    );
  }
  getConnections(tag) {
    return new HibernatingConnectionIterator(this.controller, tag);
  }
  accept(connection, options) {
    const tags = [
      connection.id,
      ...options.tags.filter((t) => t !== connection.id)
    ];
    if (tags.length > 10) {
      throw new Error(
        "A connection can only have 10 tags, including the default id tag."
      );
    }
    for (const tag of tags) {
      if (typeof tag !== "string") {
        throw new Error(`A connection tag must be a string. Received: ${tag}`);
      }
      if (tag === "") {
        throw new Error("A connection tag must not be an empty string.");
      }
      if (tag.length > 256) {
        throw new Error("A connection tag must not exceed 256 characters");
      }
    }
    this.controller.acceptWebSocket(connection, tags);
    connection.serializeAttachment({
      __pk: {
        id: connection.id,
        server: options.server
      },
      __user: null
    });
    return createLazyConnection(connection);
  }
};
var Server = class extends DurableObject {
  static {
    __name(this, "Server");
  }
  static options = {
    hibernate: false
  };
  #status = "zero";
  #ParentClass = Object.getPrototypeOf(this).constructor;
  #connectionManager = this.#ParentClass.options.hibernate ? new HibernatingConnectionManager(this.ctx) : new InMemoryConnectionManager();
  // biome-ignore lint/complexity/noUselessConstructor: <explanation>
  constructor(ctx, env) {
    super(ctx, env);
  }
  /**
   * Handle incoming requests to the server.
   */
  async fetch(request) {
    if (!this.#_name) {
      const room = request.headers.get("x-partykit-room");
      if (
        // !namespace ||
        !room
      ) {
        throw new Error(`Missing namespace or room headers when connecting to ${this.#ParentClass.name}.
Did you try connecting directly to this Durable Object? Try using getServerByName(namespace, id) instead.`);
      }
      await this.setName(room);
    }
    try {
      const url = new URL(request.url);
      if (url.pathname === "/cdn-cgi/partyserver/set-name/") {
        return Response.json({ ok: true });
      }
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return await this.onRequest(request);
      } else {
        const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
        let connectionId = url.searchParams.get("_pk");
        if (!connectionId) {
          connectionId = nanoid();
        }
        let connection = Object.assign(serverWebSocket, {
          id: connectionId,
          server: this.name,
          state: null,
          setState(setState) {
            let state;
            if (setState instanceof Function) {
              state = setState(this.state);
            } else {
              state = setState;
            }
            this.state = state;
            return this.state;
          }
        });
        const ctx = { request };
        const tags = await this.getConnectionTags(connection, ctx);
        connection = this.#connectionManager.accept(connection, {
          tags,
          server: this.name
        });
        if (!this.#ParentClass.options.hibernate) {
          this.#attachSocketEventHandlers(connection);
        }
        await this.onConnect(connection, ctx);
        return new Response(null, { status: 101, webSocket: clientWebSocket });
      }
    } catch (err) {
      console.error(
        `Error in ${this.#ParentClass.name}:${this.name} fetch:`,
        err
      );
      if (!(err instanceof Error)) throw err;
      if (request.headers.get("Upgrade") === "websocket") {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ error: err.stack }));
        pair[1].close(1011, "Uncaught exception during session setup");
        return new Response(null, { status: 101, webSocket: pair[0] });
      } else {
        return new Response(err.stack, { status: 500 });
      }
    }
  }
  async webSocketMessage(ws, message) {
    const connection = createLazyConnection(ws);
    await this.setName(connection.server);
    if (this.#status !== "started") {
      await this.#initialize();
    }
    return this.onMessage(connection, message);
  }
  async webSocketClose(ws, code, reason, wasClean) {
    const connection = createLazyConnection(ws);
    await this.setName(connection.server);
    if (this.#status !== "started") {
      await this.#initialize();
    }
    return this.onClose(connection, code, reason, wasClean);
  }
  async webSocketError(ws, error) {
    const connection = createLazyConnection(ws);
    await this.setName(connection.server);
    if (this.#status !== "started") {
      await this.#initialize();
    }
    return this.onError(connection, error);
  }
  async #initialize() {
    await this.ctx.blockConcurrencyWhile(async () => {
      this.#status = "starting";
      await this.onStart();
      this.#status = "started";
    });
  }
  #attachSocketEventHandlers(connection) {
    const handleMessageFromClient = /* @__PURE__ */ __name((event) => {
      this.onMessage(connection, event.data)?.catch((e) => {
        console.error("onMessage error:", e);
      });
    }, "handleMessageFromClient");
    const handleCloseFromClient = /* @__PURE__ */ __name((event) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("close", handleCloseFromClient);
      this.onClose(connection, event.code, event.reason, event.wasClean)?.catch(
        (e) => {
          console.error("onClose error:", e);
        }
      );
    }, "handleCloseFromClient");
    const handleErrorFromClient = /* @__PURE__ */ __name((e) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("error", handleErrorFromClient);
      this.onError(connection, e.error)?.catch((e2) => {
        console.error("onError error:", e2);
      });
    }, "handleErrorFromClient");
    connection.addEventListener("close", handleCloseFromClient);
    connection.addEventListener("error", handleErrorFromClient);
    connection.addEventListener("message", handleMessageFromClient);
  }
  // Public API
  #_name;
  #_longErrorAboutNameThrown = false;
  /**
   * The name for this server. Write-once-only.
   */
  get name() {
    if (!this.#_name) {
      if (!this.#_longErrorAboutNameThrown) {
        this.#_longErrorAboutNameThrown = true;
        throw new Error(
          `Attempting to read .name on ${this.#ParentClass.name} before it was set. The name can be set by explicitly calling .setName(name) on the stub, or by using routePartyKitRequest(). This is a known issue and will be fixed soon. Follow https://github.com/cloudflare/workerd/issues/2240 for more updates.`
        );
      } else {
        throw new Error(
          `Attempting to read .name on ${this.#ParentClass.name} before it was set.`
        );
      }
    }
    return this.#_name;
  }
  // We won't have an await inside this function
  // but it will be called remotely,
  // so we need to mark it as async
  async setName(name) {
    if (!name) {
      throw new Error("A name is required.");
    }
    if (this.#_name && this.#_name !== name) {
      throw new Error("This server already has a name.");
    }
    this.#_name = name;
    if (this.#status !== "started") {
      await this.ctx.blockConcurrencyWhile(async () => {
        await this.#initialize();
      });
    }
  }
  #sendMessageToConnection(connection, message) {
    try {
      connection.send(message);
    } catch (_e) {
      connection.close(1011, "Unexpected error");
    }
  }
  /** Send a message to all connected clients, except connection ids listed in `without` */
  broadcast(msg, without) {
    for (const connection of this.#connectionManager.getConnections()) {
      if (!without || !without.includes(connection.id)) {
        this.#sendMessageToConnection(connection, msg);
      }
    }
  }
  /** Get a connection by connection id */
  getConnection(id) {
    return this.#connectionManager.getConnection(id);
  }
  /**
   * Get all connections. Optionally, you can provide a tag to filter returned connections.
   * Use `Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections(tag) {
    return this.#connectionManager.getConnections(tag);
  }
  /**
   * You can tag a connection to filter them in Server#getConnections.
   * Each connection supports up to 9 tags, each tag max length is 256 characters.
   */
  getConnectionTags(connection, context) {
    return [];
  }
  // Implemented by the user
  /**
   * Called when the server is started for the first time.
   */
  onStart() {
  }
  /**
   * Called when a new connection is made to the server.
   */
  onConnect(connection, ctx) {
    console.log(
      `Connection ${connection.id} connected to ${this.#ParentClass.name}:${this.name}`
    );
  }
  /**
   * Called when a message is received from a connection.
   */
  onMessage(connection, message) {
    console.log(
      `Received message on connection ${this.#ParentClass.name}:${connection.id}`
    );
    console.info(
      `Implement onMessage on ${this.#ParentClass.name} to handle this message.`
    );
  }
  /**
   * Called when a connection is closed.
   */
  onClose(connection, code, reason, wasClean) {
  }
  /**
   * Called when an error occurs on a connection.
   */
  onError(connection, error) {
    console.error(
      `Error on connection ${connection.id} in ${this.#ParentClass.name}:${this.name}:`,
      error
    );
    console.info(
      `Implement onError on ${this.#ParentClass.name} to handle this error.`
    );
  }
  /**
   * Called when a request is made to the server.
   */
  onRequest(request) {
    console.warn(
      `onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.name} responding to ${request.url}`
    );
    return new Response("Not implemented", { status: 404 });
  }
  onAlarm() {
    console.log(
      `Implement onAlarm on ${this.#ParentClass.name} to handle alarms.`
    );
  }
  async alarm() {
    if (this.#status !== "started") {
      await this.#initialize();
    }
    await this.onAlarm();
  }
};

// node_modules/cron-schedule/dist/utils.js
function extractDateElements(date) {
  return {
    second: date.getSeconds(),
    minute: date.getMinutes(),
    hour: date.getHours(),
    day: date.getDate(),
    month: date.getMonth(),
    weekday: date.getDay(),
    year: date.getFullYear()
  };
}
__name(extractDateElements, "extractDateElements");
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
__name(getDaysInMonth, "getDaysInMonth");
function getDaysBetweenWeekdays(weekday1, weekday2) {
  if (weekday1 <= weekday2) {
    return weekday2 - weekday1;
  }
  return 6 - weekday1 + weekday2 + 1;
}
__name(getDaysBetweenWeekdays, "getDaysBetweenWeekdays");

// node_modules/cron-schedule/dist/cron.js
var Cron = class {
  static {
    __name(this, "Cron");
  }
  constructor({ seconds, minutes, hours, days, months, weekdays }) {
    if (!seconds || seconds.size === 0)
      throw new Error("There must be at least one allowed second.");
    if (!minutes || minutes.size === 0)
      throw new Error("There must be at least one allowed minute.");
    if (!hours || hours.size === 0)
      throw new Error("There must be at least one allowed hour.");
    if (!months || months.size === 0)
      throw new Error("There must be at least one allowed month.");
    if ((!weekdays || weekdays.size === 0) && (!days || days.size === 0))
      throw new Error("There must be at least one allowed day or weekday.");
    this.seconds = Array.from(seconds).sort((a, b) => a - b);
    this.minutes = Array.from(minutes).sort((a, b) => a - b);
    this.hours = Array.from(hours).sort((a, b) => a - b);
    this.days = Array.from(days).sort((a, b) => a - b);
    this.months = Array.from(months).sort((a, b) => a - b);
    this.weekdays = Array.from(weekdays).sort((a, b) => a - b);
    const validateData = /* @__PURE__ */ __name((name, data, constraint) => {
      if (data.some((x) => typeof x !== "number" || x % 1 !== 0 || x < constraint.min || x > constraint.max)) {
        throw new Error(`${name} must only consist of integers which are within the range of ${constraint.min} and ${constraint.max}`);
      }
    }, "validateData");
    validateData("seconds", this.seconds, { min: 0, max: 59 });
    validateData("minutes", this.minutes, { min: 0, max: 59 });
    validateData("hours", this.hours, { min: 0, max: 23 });
    validateData("days", this.days, { min: 1, max: 31 });
    validateData("months", this.months, { min: 0, max: 11 });
    validateData("weekdays", this.weekdays, { min: 0, max: 6 });
    this.reversed = {
      seconds: this.seconds.map((x) => x).reverse(),
      minutes: this.minutes.map((x) => x).reverse(),
      hours: this.hours.map((x) => x).reverse(),
      days: this.days.map((x) => x).reverse(),
      months: this.months.map((x) => x).reverse(),
      weekdays: this.weekdays.map((x) => x).reverse()
    };
  }
  /**
   * Find the next or previous hour, starting from the given start hour that matches the hour constraint.
   * startHour itself might also be allowed.
   */
  findAllowedHour(dir, startHour) {
    return dir === "next" ? this.hours.find((x) => x >= startHour) : this.reversed.hours.find((x) => x <= startHour);
  }
  /**
   * Find the next or previous minute, starting from the given start minute that matches the minute constraint.
   * startMinute itself might also be allowed.
   */
  findAllowedMinute(dir, startMinute) {
    return dir === "next" ? this.minutes.find((x) => x >= startMinute) : this.reversed.minutes.find((x) => x <= startMinute);
  }
  /**
   * Find the next or previous second, starting from the given start second that matches the second constraint.
   * startSecond itself IS NOT allowed.
   */
  findAllowedSecond(dir, startSecond) {
    return dir === "next" ? this.seconds.find((x) => x > startSecond) : this.reversed.seconds.find((x) => x < startSecond);
  }
  /**
   * Find the next or previous time, starting from the given start time that matches the hour, minute
   * and second constraints. startTime itself might also be allowed.
   */
  findAllowedTime(dir, startTime) {
    let hour = this.findAllowedHour(dir, startTime.hour);
    if (hour !== void 0) {
      if (hour === startTime.hour) {
        let minute = this.findAllowedMinute(dir, startTime.minute);
        if (minute !== void 0) {
          if (minute === startTime.minute) {
            const second = this.findAllowedSecond(dir, startTime.second);
            if (second !== void 0) {
              return { hour, minute, second };
            }
            minute = this.findAllowedMinute(dir, dir === "next" ? startTime.minute + 1 : startTime.minute - 1);
            if (minute !== void 0) {
              return {
                hour,
                minute,
                second: dir === "next" ? this.seconds[0] : this.reversed.seconds[0]
              };
            }
          } else {
            return {
              hour,
              minute,
              second: dir === "next" ? this.seconds[0] : this.reversed.seconds[0]
            };
          }
        }
        hour = this.findAllowedHour(dir, dir === "next" ? startTime.hour + 1 : startTime.hour - 1);
        if (hour !== void 0) {
          return {
            hour,
            minute: dir === "next" ? this.minutes[0] : this.reversed.minutes[0],
            second: dir === "next" ? this.seconds[0] : this.reversed.seconds[0]
          };
        }
      } else {
        return {
          hour,
          minute: dir === "next" ? this.minutes[0] : this.reversed.minutes[0],
          second: dir === "next" ? this.seconds[0] : this.reversed.seconds[0]
        };
      }
    }
    return void 0;
  }
  /**
   * Find the next or previous day in the given month, starting from the given startDay
   * that matches either the day or the weekday constraint. startDay itself might also be allowed.
   */
  findAllowedDayInMonth(dir, year, month, startDay) {
    var _a, _b;
    if (startDay < 1)
      throw new Error("startDay must not be smaller than 1.");
    const daysInMonth = getDaysInMonth(year, month);
    const daysRestricted = this.days.length !== 31;
    const weekdaysRestricted = this.weekdays.length !== 7;
    if (!daysRestricted && !weekdaysRestricted) {
      if (startDay > daysInMonth) {
        return dir === "next" ? void 0 : daysInMonth;
      }
      return startDay;
    }
    let allowedDayByDays;
    if (daysRestricted) {
      allowedDayByDays = dir === "next" ? this.days.find((x) => x >= startDay) : this.reversed.days.find((x) => x <= startDay);
      if (allowedDayByDays !== void 0 && allowedDayByDays > daysInMonth) {
        allowedDayByDays = void 0;
      }
    }
    let allowedDayByWeekdays;
    if (weekdaysRestricted) {
      const startWeekday = new Date(year, month, startDay).getDay();
      const nearestAllowedWeekday = dir === "next" ? (_a = this.weekdays.find((x) => x >= startWeekday)) !== null && _a !== void 0 ? _a : this.weekdays[0] : (_b = this.reversed.weekdays.find((x) => x <= startWeekday)) !== null && _b !== void 0 ? _b : this.reversed.weekdays[0];
      if (nearestAllowedWeekday !== void 0) {
        const daysBetweenWeekdays = dir === "next" ? getDaysBetweenWeekdays(startWeekday, nearestAllowedWeekday) : getDaysBetweenWeekdays(nearestAllowedWeekday, startWeekday);
        allowedDayByWeekdays = dir === "next" ? startDay + daysBetweenWeekdays : startDay - daysBetweenWeekdays;
        if (allowedDayByWeekdays > daysInMonth || allowedDayByWeekdays < 1) {
          allowedDayByWeekdays = void 0;
        }
      }
    }
    if (allowedDayByDays !== void 0 && allowedDayByWeekdays !== void 0) {
      return dir === "next" ? Math.min(allowedDayByDays, allowedDayByWeekdays) : Math.max(allowedDayByDays, allowedDayByWeekdays);
    }
    if (allowedDayByDays !== void 0) {
      return allowedDayByDays;
    }
    if (allowedDayByWeekdays !== void 0) {
      return allowedDayByWeekdays;
    }
    return void 0;
  }
  /** Gets the next date starting from the given start date or now. */
  getNextDate(startDate = /* @__PURE__ */ new Date()) {
    const startDateElements = extractDateElements(startDate);
    let minYear = startDateElements.year;
    let startIndexMonth = this.months.findIndex((x) => x >= startDateElements.month);
    if (startIndexMonth === -1) {
      startIndexMonth = 0;
      minYear++;
    }
    const maxIterations = this.months.length * 5;
    for (let i = 0; i < maxIterations; i++) {
      const year = minYear + Math.floor((startIndexMonth + i) / this.months.length);
      const month = this.months[(startIndexMonth + i) % this.months.length];
      const isStartMonth = year === startDateElements.year && month === startDateElements.month;
      let day = this.findAllowedDayInMonth("next", year, month, isStartMonth ? startDateElements.day : 1);
      let isStartDay = isStartMonth && day === startDateElements.day;
      if (day !== void 0 && isStartDay) {
        const nextTime = this.findAllowedTime("next", startDateElements);
        if (nextTime !== void 0) {
          return new Date(year, month, day, nextTime.hour, nextTime.minute, nextTime.second);
        }
        day = this.findAllowedDayInMonth("next", year, month, day + 1);
        isStartDay = false;
      }
      if (day !== void 0 && !isStartDay) {
        return new Date(year, month, day, this.hours[0], this.minutes[0], this.seconds[0]);
      }
    }
    throw new Error("No valid next date was found.");
  }
  /** Gets the specified amount of future dates starting from the given start date or now. */
  getNextDates(amount, startDate) {
    const dates = [];
    let nextDate;
    for (let i = 0; i < amount; i++) {
      nextDate = this.getNextDate(nextDate !== null && nextDate !== void 0 ? nextDate : startDate);
      dates.push(nextDate);
    }
    return dates;
  }
  /**
   * Get an ES6 compatible iterator which iterates over the next dates starting from startDate or now.
   * The iterator runs until the optional endDate is reached or forever.
   */
  *getNextDatesIterator(startDate, endDate) {
    let nextDate;
    while (true) {
      nextDate = this.getNextDate(nextDate !== null && nextDate !== void 0 ? nextDate : startDate);
      if (endDate && endDate.getTime() < nextDate.getTime()) {
        return;
      }
      yield nextDate;
    }
  }
  /** Gets the previous date starting from the given start date or now. */
  getPrevDate(startDate = /* @__PURE__ */ new Date()) {
    const startDateElements = extractDateElements(startDate);
    let maxYear = startDateElements.year;
    let startIndexMonth = this.reversed.months.findIndex((x) => x <= startDateElements.month);
    if (startIndexMonth === -1) {
      startIndexMonth = 0;
      maxYear--;
    }
    const maxIterations = this.reversed.months.length * 5;
    for (let i = 0; i < maxIterations; i++) {
      const year = maxYear - Math.floor((startIndexMonth + i) / this.reversed.months.length);
      const month = this.reversed.months[(startIndexMonth + i) % this.reversed.months.length];
      const isStartMonth = year === startDateElements.year && month === startDateElements.month;
      let day = this.findAllowedDayInMonth("prev", year, month, isStartMonth ? startDateElements.day : (
        // Start searching from the last day of the month.
        getDaysInMonth(year, month)
      ));
      let isStartDay = isStartMonth && day === startDateElements.day;
      if (day !== void 0 && isStartDay) {
        const prevTime = this.findAllowedTime("prev", startDateElements);
        if (prevTime !== void 0) {
          return new Date(year, month, day, prevTime.hour, prevTime.minute, prevTime.second);
        }
        if (day > 1) {
          day = this.findAllowedDayInMonth("prev", year, month, day - 1);
          isStartDay = false;
        }
      }
      if (day !== void 0 && !isStartDay) {
        return new Date(year, month, day, this.reversed.hours[0], this.reversed.minutes[0], this.reversed.seconds[0]);
      }
    }
    throw new Error("No valid previous date was found.");
  }
  /** Gets the specified amount of previous dates starting from the given start date or now. */
  getPrevDates(amount, startDate) {
    const dates = [];
    let prevDate;
    for (let i = 0; i < amount; i++) {
      prevDate = this.getPrevDate(prevDate !== null && prevDate !== void 0 ? prevDate : startDate);
      dates.push(prevDate);
    }
    return dates;
  }
  /**
   * Get an ES6 compatible iterator which iterates over the previous dates starting from startDate or now.
   * The iterator runs until the optional endDate is reached or forever.
   */
  *getPrevDatesIterator(startDate, endDate) {
    let prevDate;
    while (true) {
      prevDate = this.getPrevDate(prevDate !== null && prevDate !== void 0 ? prevDate : startDate);
      if (endDate && endDate.getTime() > prevDate.getTime()) {
        return;
      }
      yield prevDate;
    }
  }
  /** Returns true when there is a cron date at the given date. */
  matchDate(date) {
    const { second, minute, hour, day, month, weekday } = extractDateElements(date);
    if (this.seconds.indexOf(second) === -1 || this.minutes.indexOf(minute) === -1 || this.hours.indexOf(hour) === -1 || this.months.indexOf(month) === -1) {
      return false;
    }
    if (this.days.length !== 31 && this.weekdays.length !== 7) {
      return this.days.indexOf(day) !== -1 || this.weekdays.indexOf(weekday) !== -1;
    }
    return this.days.indexOf(day) !== -1 && this.weekdays.indexOf(weekday) !== -1;
  }
};

// node_modules/cron-schedule/dist/cron-parser.js
var secondConstraint = {
  min: 0,
  max: 59
};
var minuteConstraint = {
  min: 0,
  max: 59
};
var hourConstraint = {
  min: 0,
  max: 23
};
var dayConstraint = {
  min: 1,
  max: 31
};
var monthConstraint = {
  min: 1,
  max: 12,
  aliases: {
    jan: "1",
    feb: "2",
    mar: "3",
    apr: "4",
    may: "5",
    jun: "6",
    jul: "7",
    aug: "8",
    sep: "9",
    oct: "10",
    nov: "11",
    dec: "12"
  }
};
var weekdayConstraint = {
  min: 0,
  max: 7,
  aliases: {
    mon: "1",
    tue: "2",
    wed: "3",
    thu: "4",
    fri: "5",
    sat: "6",
    sun: "7"
  }
};
var timeNicknames = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@hourly": "0 * * * *",
  "@minutely": "* * * * *"
};
function parseElement(element, constraint) {
  const result = /* @__PURE__ */ new Set();
  if (element === "*") {
    for (let i = constraint.min; i <= constraint.max; i = i + 1) {
      result.add(i);
    }
    return result;
  }
  const listElements = element.split(",");
  if (listElements.length > 1) {
    for (const listElement of listElements) {
      const parsedListElement = parseElement(listElement, constraint);
      for (const x of parsedListElement) {
        result.add(x);
      }
    }
    return result;
  }
  const parseSingleElement = /* @__PURE__ */ __name((singleElement) => {
    var _a, _b;
    singleElement = (_b = (_a = constraint.aliases) === null || _a === void 0 ? void 0 : _a[singleElement.toLowerCase()]) !== null && _b !== void 0 ? _b : singleElement;
    const parsedElement = Number.parseInt(singleElement, 10);
    if (Number.isNaN(parsedElement)) {
      throw new Error(`Failed to parse ${element}: ${singleElement} is NaN.`);
    }
    if (parsedElement < constraint.min || parsedElement > constraint.max) {
      throw new Error(`Failed to parse ${element}: ${singleElement} is outside of constraint range of ${constraint.min} - ${constraint.max}.`);
    }
    return parsedElement;
  }, "parseSingleElement");
  const rangeSegments = /^(([0-9a-zA-Z]+)-([0-9a-zA-Z]+)|\*)(\/([0-9]+))?$/.exec(element);
  if (rangeSegments === null) {
    result.add(parseSingleElement(element));
    return result;
  }
  let parsedStart = rangeSegments[1] === "*" ? constraint.min : parseSingleElement(rangeSegments[2]);
  const parsedEnd = rangeSegments[1] === "*" ? constraint.max : parseSingleElement(rangeSegments[3]);
  if (constraint === weekdayConstraint && parsedStart === 7 && // this check ensures that sun-sun is not incorrectly parsed as [0,1,2,3,4,5,6]
  parsedEnd !== 7) {
    parsedStart = 0;
  }
  if (parsedStart > parsedEnd) {
    throw new Error(`Failed to parse ${element}: Invalid range (start: ${parsedStart}, end: ${parsedEnd}).`);
  }
  const step = rangeSegments[5];
  let parsedStep = 1;
  if (step !== void 0) {
    parsedStep = Number.parseInt(step, 10);
    if (Number.isNaN(parsedStep)) {
      throw new Error(`Failed to parse step: ${step} is NaN.`);
    }
    if (parsedStep < 1) {
      throw new Error(`Failed to parse step: Expected ${step} to be greater than 0.`);
    }
  }
  for (let i = parsedStart; i <= parsedEnd; i = i + parsedStep) {
    result.add(i);
  }
  return result;
}
__name(parseElement, "parseElement");
function parseCronExpression(cronExpression) {
  var _a;
  if (typeof cronExpression !== "string") {
    throw new TypeError("Invalid cron expression: must be of type string.");
  }
  cronExpression = (_a = timeNicknames[cronExpression.toLowerCase()]) !== null && _a !== void 0 ? _a : cronExpression;
  const elements = cronExpression.split(" ").filter((elem) => elem.length > 0);
  if (elements.length < 5 || elements.length > 6) {
    throw new Error("Invalid cron expression: expected 5 or 6 elements.");
  }
  const rawSeconds = elements.length === 6 ? elements[0] : "0";
  const rawMinutes = elements.length === 6 ? elements[1] : elements[0];
  const rawHours = elements.length === 6 ? elements[2] : elements[1];
  const rawDays = elements.length === 6 ? elements[3] : elements[2];
  const rawMonths = elements.length === 6 ? elements[4] : elements[3];
  const rawWeekdays = elements.length === 6 ? elements[5] : elements[4];
  return new Cron({
    seconds: parseElement(rawSeconds, secondConstraint),
    minutes: parseElement(rawMinutes, minuteConstraint),
    hours: parseElement(rawHours, hourConstraint),
    days: parseElement(rawDays, dayConstraint),
    // months in cron are indexed by 1, but Cron expects indexes by 0, so we need to reduce all set values by one.
    months: new Set(Array.from(parseElement(rawMonths, monthConstraint)).map((x) => x - 1)),
    weekdays: new Set(Array.from(parseElement(rawWeekdays, weekdayConstraint)).map((x) => x % 7))
  });
}
__name(parseCronExpression, "parseCronExpression");

// node_modules/@cloudflare/agents/dist/chunk-X57WSUMB.js
import { WorkflowEntrypoint as CFWorkflowEntrypoint } from "cloudflare:workers";
function getNextCronTime(cron) {
  const interval = parseCronExpression(cron);
  return interval.getNextDate();
}
__name(getNextCronTime, "getNextCronTime");
var STATE_ROW_ID = "cf_state_row_id";
var Agent = class extends Server {
  static {
    __name(this, "Agent");
  }
  #state = void 0;
  state;
  static options = {
    hibernate: true
    // default to hibernate
  };
  sql(strings, ...values) {
    let query = "";
    try {
      query = strings.reduce(
        (acc, str, i) => acc + str + (i < values.length ? "?" : ""),
        ""
      );
      return [...this.ctx.storage.sql.exec(query, ...values)];
    } catch (e) {
      console.error(`failed to execute sql query: ${query}`, e);
      throw e;
    }
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.sql`
      CREATE TABLE IF NOT EXISTS cf_agents_state (
        id TEXT PRIMARY KEY NOT NULL,
        state TEXT
      )
    `;
    const _this = this;
    Object.defineProperty(this, "state", {
      get() {
        if (!_this.#state) {
          const result = _this.sql`
      SELECT state FROM cf_agents_state WHERE id = ${STATE_ROW_ID}
    `;
          const state = result[0]?.state;
          if (!state) return void 0;
          _this.#state = JSON.parse(state);
          return _this.#state;
        }
        return _this.#state;
      },
      set(value) {
        throw new Error("State is read-only, use this.setState instead");
      }
    });
    void this.ctx.blockConcurrencyWhile(async () => {
      try {
        this.sql`
        CREATE TABLE IF NOT EXISTS cf_agents_schedules (
          id TEXT PRIMARY KEY NOT NULL DEFAULT (randomblob(9)),
          callback TEXT,
          payload TEXT,
          type TEXT NOT NULL CHECK(type IN ('scheduled', 'delayed', 'cron')),
          time INTEGER,
          delayInSeconds INTEGER,
          cron TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `;
        await this.alarm();
      } catch (e) {
        console.error(e);
        throw e;
      }
    });
    const _onMessage = this.onMessage.bind(this);
    this.onMessage = (connection, message) => {
      if (typeof message === "string" && message.startsWith("cf_agent_state:")) {
        const parsed = JSON.parse(message.slice(15));
        this.#setStateInternal(parsed.state, connection);
        return;
      }
      _onMessage(connection, message);
    };
    const _onConnect = this.onConnect.bind(this);
    this.onConnect = (connection, ctx2) => {
      setTimeout(() => {
        if (this.state) {
          connection.send(
            `cf_agent_state:` + JSON.stringify({ type: "cf_agent_state", state: this.state })
          );
        }
        _onConnect(connection, ctx2);
      }, 20);
    };
  }
  #setStateInternal(state, source = "server") {
    this.#state = state;
    this.sql`
    INSERT OR REPLACE INTO cf_agents_state (id, state)
    VALUES (${STATE_ROW_ID}, ${JSON.stringify(state)})
  `;
    this.broadcast(
      `cf_agent_state:` + JSON.stringify({
        type: "cf_agent_state",
        state
      }),
      source !== "server" ? [source.id] : []
    );
    this.onStateUpdate(state, source);
  }
  setState(state) {
    this.#setStateInternal(state, "server");
  }
  #warnedToImplementOnStateUpdate = false;
  onStateUpdate(state, source) {
    if (!this.#warnedToImplementOnStateUpdate) {
      console.log(
        "state updated, implement onStateUpdate in your agent to handle this change"
      );
      this.#warnedToImplementOnStateUpdate = true;
    }
  }
  // onMessage(connection: Connection, message: WSMessage) {}
  // onConnect(connection: Connection, ctx: ConnectionContext) {}
  onEmail(email) {
    throw new Error("Not implemented");
  }
  render() {
    throw new Error("Not implemented");
  }
  async schedule(when, callback, payload) {
    const id = nanoid(9);
    if (when instanceof Date) {
      const timestamp = Math.floor(when.getTime() / 1e3);
      this.sql`
        INSERT OR REPLACE INTO cf_agents_schedules (id, callback, payload, type, time)
        VALUES (${id}, ${callback}, ${JSON.stringify(
        payload
      )}, 'scheduled', ${timestamp})
      `;
      await this.scheduleNextAlarm();
      return {
        id,
        callback,
        payload,
        time: timestamp,
        type: "scheduled"
      };
    } else if (typeof when === "number") {
      const time = new Date(Date.now() + when * 1e3);
      const timestamp = Math.floor(time.getTime() / 1e3);
      this.sql`
        INSERT OR REPLACE INTO cf_agents_schedules (id, callback, payload, type, delayInSeconds, time)
        VALUES (${id}, ${callback}, ${JSON.stringify(
        payload
      )}, 'delayed', ${when}, ${timestamp})
      `;
      await this.scheduleNextAlarm();
      return {
        id,
        callback,
        payload,
        delayInSeconds: when,
        time: timestamp,
        type: "delayed"
      };
    } else if (typeof when === "string") {
      const nextExecutionTime = getNextCronTime(when);
      const timestamp = Math.floor(nextExecutionTime.getTime() / 1e3);
      this.sql`
        INSERT OR REPLACE INTO cf_agents_schedules (id, callback, payload, type, cron, time)
        VALUES (${id}, ${callback}, ${JSON.stringify(
        payload
      )}, 'cron', ${when}, ${timestamp})
      `;
      await this.scheduleNextAlarm();
      return {
        id,
        callback,
        payload,
        cron: when,
        time: timestamp,
        type: "cron"
      };
    } else {
      throw new Error("Invalid schedule type");
    }
  }
  async getSchedule(id) {
    const result = this.sql`
      SELECT * FROM cf_agents_schedules WHERE id = ${id}
    `;
    if (!result) return void 0;
    return { ...result[0], payload: JSON.parse(result[0].payload) };
  }
  getSchedules(criteria = {}) {
    let query = "SELECT * FROM cf_agents_schedules WHERE 1=1";
    const params = [];
    if (criteria.id) {
      query += " AND id = ?";
      params.push(criteria.id);
    }
    if (criteria.description) {
      query += " AND description = ?";
      params.push(criteria.description);
    }
    if (criteria.type) {
      query += " AND type = ?";
      params.push(criteria.type);
    }
    if (criteria.timeRange) {
      query += " AND time >= ? AND time <= ?";
      const start = criteria.timeRange.start || /* @__PURE__ */ new Date(0);
      const end = criteria.timeRange.end || /* @__PURE__ */ new Date(999999999999999);
      params.push(
        Math.floor(start.getTime() / 1e3),
        Math.floor(end.getTime() / 1e3)
      );
    }
    const result = this.ctx.storage.sql.exec(query, ...params).toArray().map((row) => ({
      ...row,
      payload: JSON.parse(row.payload)
    }));
    return result;
  }
  async cancelSchedule(id) {
    this.sql`DELETE FROM cf_agents_schedules WHERE id = ${id}`;
    await this.scheduleNextAlarm();
    return true;
  }
  async scheduleNextAlarm() {
    const result = this.sql`
      SELECT time FROM cf_agents_schedules 
      WHERE time > ${Math.floor(Date.now() / 1e3)}
      ORDER BY time ASC 
      LIMIT 1
    `;
    if (!result) return;
    if (result.length > 0 && "time" in result[0]) {
      const nextTime = result[0].time * 1e3;
      await this.ctx.storage.setAlarm(nextTime);
    }
  }
  async alarm() {
    const now = Math.floor(Date.now() / 1e3);
    const result = this.sql`
      SELECT * FROM cf_agents_schedules WHERE time <= ${now}
    `;
    for (const row of result || []) {
      const callback = this[row.callback];
      if (!callback) {
        console.error(`callback ${row.callback} not found`);
        continue;
      }
      try {
        callback.bind(this)(JSON.parse(row.payload), row);
      } catch (e) {
        console.error(`error executing callback ${row.callback}`, e);
      }
      if (row.type === "cron") {
        const nextExecutionTime = getNextCronTime(row.cron);
        const nextTimestamp = Math.floor(nextExecutionTime.getTime() / 1e3);
        this.sql`
          UPDATE cf_agents_schedules SET time = ${nextTimestamp} WHERE id = ${row.id}
        `;
      } else {
        this.sql`
          DELETE FROM cf_agents_schedules WHERE id = ${row.id}
        `;
      }
    }
    await this.scheduleNextAlarm();
  }
  async destroy() {
    this.sql`DROP TABLE IF EXISTS cf_agents_state`;
    this.sql`DROP TABLE IF EXISTS cf_agents_schedules`;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
};

// src/agent.ts
var CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
var EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";
var MyAgent = class extends Agent {
  static {
    __name(this, "MyAgent");
  }
  /** Short-term conversation buffer (lives with this Durable Object instance) */
  _recent = [];
  /** Small structured profile we always inject into the prompt */
  profile = { likes: [], custom: [] };
  /** Lazy-load flag for profile persistence (optional) */
  loaded = false;
  // ----------------- Public RPCs -----------------
  /** Non-streaming chat */
  async chat({ message }) {
    await this.ensureLoaded();
    const factsChanged = this.tryCaptureFacts(message);
    if (factsChanged) {
      try {
        const st = this.storage;
        if (st && typeof st.put === "function") {
          await st.put("profile", this.profile);
        }
      } catch {
      }
    }
    this.pushRecent({ role: "user", text: message });
    const userVec = await this.embed(message);
    if (userVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `u:${Date.now()}`, values: userVec, metadata: { role: "user", text: message } }
      ]);
    }
    const history = this.buildHistory();
    await this.prependMemories(history, userVec);
    const aiResp = await this.env.AI.run(CHAT_MODEL, { messages: history, stream: false });
    const assistantText = aiResp?.response ?? aiResp?.result ?? aiResp?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";
    this.pushRecent({ role: "assistant", text: assistantText });
    const asstVec = await this.embed(assistantText);
    if (asstVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `a:${Date.now()}`, values: asstVec, metadata: { role: "assistant", text: assistantText } }
      ]);
    }
    return { text: assistantText };
  }
  /** Streaming chat (Server-Sent Events) */
  async streamChat({ message }) {
    await this.ensureLoaded();
    const factsChanged = this.tryCaptureFacts(message);
    if (factsChanged) {
      try {
        const st = this.storage;
        if (st && typeof st.put === "function") {
          await st.put("profile", this.profile);
        }
      } catch {
      }
    }
    this.pushRecent({ role: "user", text: message });
    const userVec = await this.embed(message);
    if (userVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `u:${Date.now()}`, values: userVec, metadata: { role: "user", text: message } }
      ]);
    }
    const history = this.buildHistory();
    await this.prependMemories(history, userVec);
    const aiStream = await this.env.AI.run(CHAT_MODEL, { messages: history, stream: true });
    const encoder = new TextEncoder();
    const ts = new TransformStream();
    const writer = ts.writable.getWriter();
    (async () => {
      let full = "";
      try {
        for await (const chunk of aiStream) {
          const token = chunk?.response ?? chunk?.delta ?? "";
          if (token) {
            full += token;
            await writer.write(encoder.encode(`data: ${token}

`));
          }
        }
        this.pushRecent({ role: "assistant", text: full });
        const asstVec = await this.embed(full);
        if (asstVec) {
          await this.env.VECTORIZE_INDEX.upsert([
            { id: `a:${Date.now()}`, values: asstVec, metadata: { role: "assistant", text: full } }
          ]);
        }
        await writer.write(encoder.encode(`event: done
data:

`));
      } catch (e) {
        await writer.write(encoder.encode(`event: error
data: ${String(e)}

`));
      } finally {
        await writer.close();
      }
    })();
    return { readable: ts.readable };
  }
  /** Used by the right panel in your UI */
  getRecent() {
    return { recent: this._recent.slice(-10) };
  }
  // ----------------- Helpers -----------------
  /** Load profile from Durable Object storage (once) */
  // 1) replace your ensureLoaded() with this guarded version
  async ensureLoaded() {
    if (this.loaded) return;
    try {
      const st = this.storage;
      if (st && typeof st.get === "function") {
        const saved = await st.get("profile");
        if (saved && typeof saved === "object") {
          this.profile = { likes: [], custom: [], ...saved };
        }
      }
    } catch {
    }
    this.loaded = true;
  }
  /** Parse “remember …” into structured facts. Returns true if profile changed. */
  tryCaptureFacts(message) {
    const before = JSON.stringify(this.profile);
    const raw = message.trim();
    const lower = raw.toLowerCase();
    if (!lower.startsWith("remember")) return false;
    const nameMatch = /my\s+name\s+is\s+([a-z][a-z' -]{1,40})/i.exec(raw);
    if (nameMatch) {
      const name = this.cleanScalar(nameMatch[1]);
      if (name) this.profile.name = this.titleCase(name);
    }
    const likeMatch = /\bi\s+(?:like|love)\s+(.+)$/i.exec(raw);
    if (likeMatch) {
      const like = this.cleanScalar(likeMatch[1]);
      if (like) this.pushUnique(this.profile.likes, like);
    }
    const favMatch = /my\s+favorite\s+([a-z ]+?)\s+is\s+(.+)$/i.exec(raw);
    if (favMatch) {
      const what = this.cleanScalar(favMatch[1]);
      const val = this.cleanScalar(favMatch[2]);
      if (what && val) this.pushUnique(this.profile.likes, `${what}: ${val}`);
    }
    if (!nameMatch && !likeMatch && !favMatch) {
      const custom = raw.replace(/^remember\s*/i, "").trim();
      if (custom) this.pushUnique(this.profile.custom, custom);
    }
    return JSON.stringify(this.profile) !== before;
  }
  pushRecent(m) {
    this._recent.push(m);
    if (this._recent.length > 20) this._recent.splice(0, this._recent.length - 20);
  }
  /** Build conversation history sent to the model */
  buildHistory() {
    const history = [
      { role: "system", content: "You are a helpful, concise assistant." }
    ];
    for (const m of this._recent) {
      history.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.text });
    }
    return history;
  }
  /** Prepend explicit profile + semantic recall to the prompt */
  async prependMemories(history, userVec) {
    const facts = [];
    if (this.profile.name) facts.push(`name: ${this.profile.name}`);
    if (this.profile.likes.length) facts.push(`likes: ${this.profile.likes.join(", ")}`);
    if (this.profile.custom.length) facts.push(...this.profile.custom);
    if (facts.length) {
      history.unshift({
        role: "system",
        content: `Known user profile (treat as true unless contradicted):
` + facts.map((f) => `- ${f}`).join("\n")
      });
    }
    if (userVec) {
      const recalled = await this.recall(userVec, 4);
      if (recalled.length) {
        history.unshift({
          role: "system",
          content: `Relevant notes from memory:
- ${recalled.join("\n- ")}`
        });
      }
    }
  }
  cleanScalar(s) {
    return s.replace(/^that\s+/i, "").replace(/[.?!]+$/g, "").trim();
  }
  titleCase(s) {
    return s.split(/\s+/).map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  pushUnique(arr, v) {
    const key = v.toLowerCase();
    if (!arr.some((x) => x.toLowerCase() === key)) arr.push(v);
  }
  async embed(text) {
    try {
      const resp = await this.env.AI.run(EMBED_MODEL, { text });
      const vec = resp?.embedding ?? resp?.data?.[0]?.embedding;
      return Array.isArray(vec) ? vec : null;
    } catch {
      return null;
    }
  }
  async recall(vec, topK = 4) {
    try {
      const q = await this.env.VECTORIZE_INDEX.query(vec, { topK });
      return (q?.matches ?? []).map((m) => m?.metadata?.text).filter(Boolean);
    } catch {
      return [];
    }
  }
};

// src/index.ts
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("OK. Open /app", { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const { message } = await req.json();
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const result = await stub.chat({ message });
        return Response.json(result);
      } catch (e) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    }
    if (url.pathname === "/api/chat-stream" && req.method === "POST") {
      try {
        const { message } = await req.json();
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const { readable } = await stub.streamChat({ message });
        return new Response(readable, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "connection": "keep-alive"
          }
        });
      } catch (e) {
        return new Response(`event: error
data: ${String(e?.message || e)}

`, {
          headers: { "content-type": "text/event-stream" }
        });
      }
    }
    if (url.pathname === "/api/recent" && req.method === "GET") {
      try {
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const recent = await stub.getRecent?.();
        return Response.json(recent ?? { recent: [] });
      } catch (e) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    }
    if (url.pathname === "/app") {
      return new Response(await appPage(), { headers: { "content-type": "text/html" } });
    }
    return new Response("Not found", { status: 404 });
  }
};
async function appPage() {
  return (
    /* html */
    `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>FlixChat \u2022 AI Agent</title>
    <style>
      :root{
        --bg:#0b0b0b; --bg-hero:#141414; --card:#141414; --muted:#b3b3b3; --text:#ffffff;
        --red:#e50914; --chip:#2a2a2a; --border:#222; --bubble-user:#1f1f1f; --bubble-ai:#0f0f0f;
        --shadow:0 10px 30px rgba(0,0,0,.35);
      }
      *{box-sizing:border-box} html,body{height:100%}
      body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,Arial}

      .hero{
        background:
          radial-gradient(1200px 400px at 20% -10%, rgba(229,9,20,.35), transparent 50%),
          radial-gradient(1000px 300px at 80% -20%, rgba(229,9,20,.25), transparent 55%),
          var(--bg-hero);
        border-bottom:1px solid var(--border); box-shadow:var(--shadow);
      }
      .hero-inner{max-width:1280px;margin:0 auto;padding:26px 18px 18px;display:flex;align-items:center;gap:14px}
      .logo{width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:linear-gradient(180deg,var(--red),#a4060e);color:#fff;font-weight:900}
      .brand{font-size:20px;font-weight:800;letter-spacing:.4px}
      .chip{margin-left:auto;background:var(--chip);border:1px solid var(--border);padding:6px 10px;border-radius:999px;color:var(--muted);font-size:12px}

      .grid{
        max-width:1280px;margin:24px auto 32px;padding:0 18px;
        display:grid; gap:16px; grid-template-columns: 240px 1fr 300px;
      }
      @media (max-width:1100px){ .grid{grid-template-columns: 1fr} .aside-left,.aside-right{display:none} }

      .panel{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
      .panel-head{padding:14px 16px;border-bottom:1px solid var(--border);font-weight:800}
      .panel-body{padding:12px 16px}

      .profile{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#121212;border:1px solid var(--border);margin-bottom:10px}
      .pfp{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:#2b2b2b}
      .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#1a1a1a;border:1px solid var(--border);color:var(--muted);font-size:12px;margin:4px 6px 0 0}

      .card{overflow:hidden; position:relative;}
      .card-head{padding:16px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
      .title{font-weight:800;font-size:22px}
      .subtitle{color:var(--muted);font-size:13px}
      .row{display:flex;gap:10px;align-items:center;margin-left:auto}
      .btn{padding:10px 14px;border-radius:10px;border:1px solid #3a3a3a;background:#1a1a1a;color:#fff;cursor:pointer}
      .btn.primary{border-color:var(--red);background:linear-gradient(180deg,#ff2a35,var(--red))}
      .btn:disabled{opacity:.6;cursor:not-allowed}
      .toggle{display:flex;align-items:center;gap:8px;background:#0f0f0f;border:1px solid var(--border);padding:8px 10px;border-radius:12px;color:var(--muted);font-size:12px}

      .history{height:min(60vh,580px);overflow:auto;padding:18px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
      .msg{display:flex;gap:10px;align-items:flex-start}
      .avatar{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:12px;color:#fff;flex:0 0 auto}
      .avatar.user{background:#303030} .avatar.ai{background:var(--red)}
      .bubble{padding:12px 14px;border-radius:14px;border:1px solid var(--border);max-width:70%;line-height:1.45;box-shadow:var(--shadow)}
      .user .bubble{background:var(--bubble-user)} .ai .bubble{background:var(--bubble-ai)}
      .time{color:var(--muted);font-size:11px;margin-top:4px}

      .composer{display:flex;gap:10px;padding:12px;border-top:1px solid var(--border);background:#0e0e0e; position:sticky; bottom:0; z-index:3;}
      .input{flex:1;padding:14px;border-radius:12px;border:1px solid var(--border);background:#0a0a0a;color:#fff;outline:none}

      .list{display:grid;gap:8px}
      .mem{padding:10px 12px;border-radius:10px;background:#101010;border:1px solid var(--border);color:#ddd}
      .kbd{display:inline-block;border:1px solid var(--border);background:#171717;padding:2px 6px;border-radius:6px;font-size:12px;margin-right:6px;color:#cfcfcf}
      .muted{color:var(--muted);font-size:12px}
    </style>
  </head>
  <body>
    <header class="hero">
      <div class="hero-inner">
        <div class="logo">N</div>
        <div class="brand">FlixChat</div>
        <div class="chip">Workers AI \u2022 Vectorize \u2022 Agents</div>
      </div>
    </header>

    <div class="grid">
      <aside class="panel aside-left">
        <div class="panel-head">Profiles</div>
        <div class="panel-body">
          <div class="profile"><div class="pfp">\u{1F464}</div><div><div><b>Main</b></div><div class="muted">General assistant</div></div></div>
          <div class="profile"><div class="pfp">\u{1F9E0}</div><div><div><b>Research</b></div><div class="muted">Long-form reasoning</div></div></div>
          <div class="profile"><div class="pfp">\u{1F6E0}\uFE0F</div><div><div><b>Dev</b></div><div class="muted">Code helper</div></div></div>
          <div style="margin-top:12px">
            <span class="pill">/clear</span>
            <span class="pill">/summarize</span>
            <span class="pill">/remember</span>
          </div>
        </div>
      </aside>

      <main class="panel card">
        <div class="card-head">
          <div>
            <div class="title">Talk to your Agent</div>
            <div class="subtitle">Remembers facts with Vectorize. Stream responses in real time.</div>
          </div>
          <div class="row">
            <button id="clear" class="btn">Clear</button>
            <label class="toggle"><input id="streamToggle" type="checkbox" /> Stream</label>
          </div>
        </div>

        <div id="history" class="history"></div>

        <div class="composer">
          <input id="msg" class="input" placeholder="Ask anything\u2026 try: \u201Cremember my name is Sam and I like basketball\u201D" />
          <button id="send" type="button" class="btn primary">Send</button>
        </div>
      </main>

      <aside class="panel aside-right">
        <div class="panel-head">Live Memory</div>
        <div class="panel-body"><div id="memList" class="list"></div></div>
        <div class="panel-head">Shortcuts</div>
        <div class="panel-body">
          <div><span class="kbd">Enter</span><span class="muted">Send</span></div>
          <div><span class="kbd">Shift + Enter</span><span class="muted">New line</span></div>
          <div><span class="kbd">S</span><span class="muted">Toggle Stream</span></div>
          <div><span class="kbd">Esc</span><span class="muted">Focus input</span></div>
        </div>
      </aside>
    </div>

    <script>
      const history = document.getElementById('history');
      const input   = document.getElementById('msg');
      const sendBtn = document.getElementById('send');
      const streamT = document.getElementById('streamToggle');
      const clearBtn= document.getElementById('clear');
      const memList = document.getElementById('memList');

      function nowTime(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
      function setBusy(b){ sendBtn.disabled = b; input.disabled = b; }
      function append(role, text){
        const wrap = document.createElement('div'); wrap.className = 'msg ' + role;
        const avatar = document.createElement('div'); avatar.className = 'avatar ' + (role==='user'?'user':'ai'); avatar.textContent = role==='user'?'U':'A';
        const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
        const time = document.createElement('div'); time.className='time'; time.textContent = nowTime();
        const col = document.createElement('div'); col.appendChild(bubble); col.appendChild(time);
        wrap.appendChild(avatar); wrap.appendChild(col);
        history.appendChild(wrap); history.scrollTop = history.scrollHeight;
      }

      async function postJSON(url, body){
        const res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
        if(!res.ok){ try{ const j = await res.json(); throw new Error(j.error||'Request failed'); } catch{ throw new Error('Request failed'); } }
        return res.json();
      }

      async function refreshMemory(){
        try{
          const res = await fetch('/api/recent'); if(!res.ok) return;
          const data = await res.json();
          const items = (data?.recent || []).slice().reverse();
          memList.innerHTML = '';
          for(const m of items){
            const div = document.createElement('div');
            div.className = 'mem';
            div.textContent = (m.role === 'assistant' ? 'A: ' : 'U: ') + m.text;
            memList.appendChild(div);
          }
        }catch{}
      }

      function parseSSEChunk(chunk, onData, onEvent){
        const lines = chunk.split('\\n');
        for(const raw of lines){
          const line = raw.trim();
          if(!line) continue;
          if(line.startsWith('data: ')){
            const payload = line.slice(6);
            if(payload === '' || payload === '[END]') continue; // ignore end/empty markers
            onData(payload);
          } else if(line.startsWith('event: ')){
            onEvent(line.slice(7).trim());
          }
        }
      }

      async function send(){
        const message = input.value.trim(); if(!message) return;
        input.value=''; append('user', message); setBusy(true);

        try{
          if(streamT && streamT.checked){
            // streaming
            append('ai', ''); const lastBubble = history.querySelector('.msg.ai:last-child .bubble');
            const res = await fetch('/api/chat-stream', {
              method:'POST', headers:{'content-type':'application/json'},
              body: JSON.stringify({ message })
            });
            if(!res.ok || !res.body) throw new Error('Stream failed');

            const reader = res.body.getReader(); const dec = new TextDecoder();
            while(true){
              const {value, done} = await reader.read(); if(done) break;
              parseSSEChunk(dec.decode(value, {stream:true}),
                (token)=> { lastBubble.textContent += token; history.scrollTop = history.scrollHeight; },
                (_ev)=> {}
              );
            }
          }else{
            // non-streaming
            const data = await postJSON('/api/chat', { message });
            append('ai', data.text || '(no response)');
          }
          await refreshMemory();
        }catch(e){
          append('ai', '\u26A0\uFE0F ' + (e.message || e));
        }finally{
          setBusy(false); input.focus();
        }
      }

      // Wire events after DOM is ready
      window.addEventListener('DOMContentLoaded', () => {
        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', (e)=> {
          if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
        });
        if (clearBtn) clearBtn.addEventListener('click', ()=> { history.innerHTML=''; });
        document.addEventListener('keydown', (e)=> {
          if(e.key==='s' || e.key==='S') { if (streamT) streamT.checked = !streamT.checked; }
          if(e.key==='Escape') input.focus();
        });
        append('ai','Welcome to FlixChat. Tell me something to remember.');
        refreshMemory();
      });
    <\/script>
  </body>
</html>
`
  );
}
__name(appPage, "appPage");

// C:/Users/ADMIN/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/ADMIN/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-eEzcaS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/ADMIN/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-eEzcaS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  MyAgent,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
