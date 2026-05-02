// src/scheduler.js
const cron = require('node-cron');

class Scheduler {
  constructor() { this.jobs = []; }

  registerDaily(schedules, callback) {
    schedules.forEach(time => {
      const [hour, minute] = time.trim().split(':');
      const expr = `${minute} ${hour} * * *`;
      if (!cron.validate(expr)) { console.warn('[Scheduler] Horário inválido:', time); return; }
      const job = cron.schedule(expr, () => {
        console.log('⏰ Horário atingido:', time);
        callback();
      }, { timezone: 'America/Sao_Paulo' });
      this.jobs.push(job);
      console.log('⏰ Agendado:', time);
    });
  }

  stopAll() { this.jobs.forEach(j => j.stop()); this.jobs = []; }
}

module.exports = { Scheduler };

