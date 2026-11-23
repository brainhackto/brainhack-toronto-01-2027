/* Schedule component: renders assets/data/schedule.json into #agenda.
   Day tabs, colour-coded session types (click a legend chip to filter),
   a "happening now" highlight during the event, and an .ics download. */
(function () {
	var TYPES = {
		hacking:   { label: 'Open hacking', icon: 'fa-laptop-code' },
		workshop:  { label: 'TrainTrack',   icon: 'fa-graduation-cap' },
		talk:      { label: 'Talks & panels', icon: 'fa-microphone' },
		break:     { label: 'Breaks & meals', icon: 'fa-coffee' },
		social:    { label: 'Social',       icon: 'fa-users' },
		logistics: { label: 'Logistics',    icon: 'fa-info-circle' }
	};

	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function fmtTime(hhmm) {
		var p = hhmm.split(':'), h = +p[0], m = p[1];
		return (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM');
	}

	function fmtDay(iso, opts) {
		var p = iso.split('-');
		return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-CA', opts);
	}

	// Current date and time in the event's time zone, as "YYYY-MM-DD" and "HH:MM".
	function nowIn(tz) {
		try {
			var parts = {};
			new Intl.DateTimeFormat('en-CA', {
				timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
				hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
			}).formatToParts(new Date()).forEach(function (x) { parts[x.type] = x.value; });
			return { date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute };
		} catch (e) { return { date: '', time: '' }; }
	}

	function buildIcs(data) {
		var tz = data.timezone || 'America/Toronto';
		var esc = function (s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
		var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
		var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BrainHack Toronto//Schedule//EN', 'CALSCALE:GREGORIAN'];
		data.days.forEach(function (day) {
			var d = day.date.replace(/-/g, '');
			day.sessions.forEach(function (s, i) {
				lines.push('BEGIN:VEVENT',
					'UID:bhto-' + d + '-' + i + '@brainhackto.github.io',
					'DTSTAMP:' + stamp,
					'DTSTART;TZID=' + tz + ':' + d + 'T' + s.start.replace(':', '') + '00',
					'DTEND;TZID=' + tz + ':' + d + 'T' + s.end.replace(':', '') + '00',
					'SUMMARY:' + esc('BrainHack Toronto: ' + s.title),
					'LOCATION:' + esc(s.location || data.location),
					'DESCRIPTION:' + esc([s.speaker, s.description].filter(Boolean).join(' - ')),
					'END:VEVENT');
			});
		});
		lines.push('END:VCALENDAR');
		return lines.join('\r\n');
	}

	function render(root, data) {
		root.textContent = '';
		var now = nowIn(data.timezone || 'America/Toronto');
		var hidden = {};

		if (data.status === 'draft') {
			var note = el('p', 'agenda-note');
			note.appendChild(el('i', 'fas fa-info-circle'));
			note.appendChild(document.createTextNode(' Tentative schedule: times and sessions may change before the event.'));
			root.appendChild(note);
		}

		// Day tabs
		var tabs = el('div', 'agenda-tabs');
		tabs.setAttribute('role', 'tablist');
		root.appendChild(tabs);

		// Legend / filter
		var used = {};
		data.days.forEach(function (d) { d.sessions.forEach(function (s) { used[s.type] = true; }); });
		var legend = el('div', 'agenda-legend');
		Object.keys(TYPES).forEach(function (t) {
			if (!used[t]) return;
			var chip = el('button', 'agenda-chip type-' + t);
			chip.type = 'button';
			chip.setAttribute('aria-pressed', 'true');
			chip.title = 'Show or hide ' + TYPES[t].label.toLowerCase();
			chip.appendChild(el('span', 'agenda-dot'));
			chip.appendChild(document.createTextNode(TYPES[t].label));
			chip.addEventListener('click', function () {
				hidden[t] = !hidden[t];
				chip.setAttribute('aria-pressed', hidden[t] ? 'false' : 'true');
				root.querySelectorAll('.agenda-item.type-' + t).forEach(function (n) { n.hidden = hidden[t]; });
			});
			legend.appendChild(chip);
		});
		root.appendChild(legend);

		// Panels
		var panels = [], buttons = [];
		var startIdx = 0;
		data.days.forEach(function (day, i) {
			if (day.date === now.date) startIdx = i;

			var btn = el('button', 'agenda-tab');
			btn.type = 'button';
			btn.setAttribute('role', 'tab');
			btn.appendChild(el('span', 'agenda-tab-label', day.label || ('Day ' + (i + 1))));
			btn.appendChild(el('span', 'agenda-tab-date', fmtDay(day.date, { weekday: 'short', month: 'short', day: 'numeric' })));
			btn.addEventListener('click', function () { select(i); });
			tabs.appendChild(btn);
			buttons.push(btn);

			var panel = el('ol', 'agenda-list');
			panel.setAttribute('role', 'tabpanel');
			panel.setAttribute('aria-label', fmtDay(day.date, { weekday: 'long', month: 'long', day: 'numeric' }));
			day.sessions.forEach(function (s) {
				var type = TYPES[s.type] ? s.type : 'hacking';
				var li = el('li', 'agenda-item type-' + type);
				var live = day.date === now.date && now.time >= s.start && now.time < s.end;
				if (live) li.classList.add('is-now');

				var time = el('div', 'agenda-time');
				time.appendChild(el('span', 'agenda-start', fmtTime(s.start)));
				time.appendChild(el('span', 'agenda-end', fmtTime(s.end)));
				li.appendChild(time);

				var body = el('div', 'agenda-body');
				var head = el('div', 'agenda-head');
				var icon = el('i', 'fas ' + TYPES[type].icon + ' agenda-icon');
				icon.setAttribute('aria-hidden', 'true');
				head.appendChild(icon);
				head.appendChild(el('span', 'agenda-title', s.title));
				if (live) head.appendChild(el('span', 'agenda-live', 'Happening now'));
				body.appendChild(head);
				if (s.speaker) body.appendChild(el('div', 'agenda-speaker', s.speaker));
				if (s.description) body.appendChild(el('div', 'agenda-desc', s.description));
				if (s.location) body.appendChild(el('div', 'agenda-loc', s.location));
				li.appendChild(body);
				panel.appendChild(li);
			});
			root.appendChild(panel);
			panels.push(panel);
		});

		function select(i) {
			panels.forEach(function (p, j) { p.hidden = j !== i; });
			buttons.forEach(function (b, j) {
				b.classList.toggle('active', j === i);
				b.setAttribute('aria-selected', j === i ? 'true' : 'false');
			});
		}
		select(startIdx);

		// Footer: location + calendar download
		var foot = el('div', 'agenda-foot');
		foot.appendChild(el('span', 'agenda-where', 'All times Toronto time (EST) · ' + data.location));
		var dl = el('a', 'agenda-ics');
		dl.appendChild(el('i', 'fas fa-calendar-plus'));
		dl.appendChild(document.createTextNode(' Add to my calendar'));
		dl.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildIcs(data));
		dl.download = 'brainhack-toronto-schedule.ics';
		foot.appendChild(dl);
		root.appendChild(foot);
	}

	document.addEventListener('DOMContentLoaded', function () {
		var root = document.getElementById('agenda');
		if (!root) return;
		fetch(root.getAttribute('data-src') || 'assets/data/schedule.json', { cache: 'no-cache' })
			.then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
			.then(function (data) { render(root, data); })
			.catch(function () {
				root.textContent = '';
				root.appendChild(el('p', 'agenda-note', 'The schedule could not be loaded. Please check back soon.'));
			});
	});
})();
