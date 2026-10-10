(function () {

        if (document.getElementById('liveStartingSoon')) {
        setTimeout(() => window.location.reload(), 20000);
        return;
    }

    
    const box = document.getElementById('liveCountdown');
    if (!box) return;

    const target = new Date(box.dataset.startsAt).getTime();
    if (isNaN(target)) return;

    const units = {
        days: box.querySelector('[data-unit="days"]'),
        hours: box.querySelector('[data-unit="hours"]'),
        minutes: box.querySelector('[data-unit="minutes"]'),
        seconds: box.querySelector('[data-unit="seconds"]')
    };
    const label = document.getElementById('liveCountdownLabel');
    const pad = n => String(n).padStart(2, '0');

    let reloaded = false;

    function set(unit, value) {
        const el = units[unit];
        if (el && el.textContent !== value) el.textContent = value;
    }

    function render() {
        const diff = target - Date.now();

        if (diff <= 0) {
            ['days', 'hours', 'minutes', 'seconds'].forEach(u => set(u, '00'));
            if (label) label.lastChild.textContent = ' Starting now...';
            // cron test generate karne me thoda time leta hai, isliye 5 sec baad reload
            if (!reloaded) {
                reloaded = true;
                setTimeout(() => window.location.reload(), 5000);
            }
            return;
        }

        set('days', pad(Math.floor(diff / 86400000)));
        set('hours', pad(Math.floor((diff % 86400000) / 3600000)));
        set('minutes', pad(Math.floor((diff % 3600000) / 60000)));
        set('seconds', pad(Math.floor((diff % 60000) / 1000)));
    }

    render();
    setInterval(render, 1000);
})();