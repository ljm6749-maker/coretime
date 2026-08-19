/**
 * 글로벌 네트워크 지도
 * - 육지 도트: world-mask.js 의 비트마스크를 정방형 도법(equirectangular)으로 캔버스에 렌더링
 * - 명암: 실제 태양 위치를 계산해 낮/밤 영역을 구분
 * - 마커: 법인 위치 + 실시간 현지시각(또는 선택한 회의 시각)
 */
(function (global) {
  'use strict';

  var mask = global.WORLD_MASK;
  var TZ = global.TZ;

  var COLORS = {
    day:      'rgba(163, 195, 240, 0.95)',
    twilight: 'rgba(96, 124, 172, 0.8)',
    night:    'rgba(40, 54, 82, 0.62)'
  };

  function decodeBits(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  var bits = decodeBits(mask.bits);

  function isLand(col, row) {
    var idx = row * mask.cols + col;
    return (bits[idx >> 3] & (1 << (idx & 7))) !== 0;
  }

  /** 지정 시각의 태양 직하점(위도/경도) */
  function subsolarPoint(utcMs) {
    var n = utcMs / 86400000 + 2440587.5 - 2451545.0;
    var rad = Math.PI / 180;
    var L = (280.460 + 0.9856474 * n) % 360;
    var g = ((357.528 + 0.9856003 * n) % 360) * rad;
    var lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var eps = (23.439 - 0.0000004 * n) * rad;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad;
    var eot = 4 * (((L - 0.0057183 - ra) % 360 + 540) % 360 - 180); // 균시차(분)
    var utcHours = (utcMs % 86400000) / 3600000;
    var lon = -15 * (utcHours + eot / 60 - 12);
    lon = ((lon + 540) % 360) - 180;
    return { lat: dec / rad, lon: lon };
  }

  function solarAltitude(lat, lon, sun) {
    var rad = Math.PI / 180;
    var h = (lon - sun.lon) * rad;
    return Math.asin(
      Math.sin(lat * rad) * Math.sin(sun.lat * rad) +
      Math.cos(lat * rad) * Math.cos(sun.lat * rad) * Math.cos(h)
    ) / rad;
  }

  function MapView(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d');
    this.markers = {};
    this.selected = null;      // 참여 법인 id 배열 (null = 전체 활성)
    this.meeting = null;       // { utcStart, durationMin, statusById }
    this.buildMarkers();

    var self = this;
    var resizeTimer;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.render(); }, 120);
    });
  }

  MapView.prototype.project = function (lat, lon) {
    return {
      x: (lon - mask.lonMin) / (mask.lonMax - mask.lonMin),
      y: (mask.latMax - lat) / (mask.latMax - mask.latMin)
    };
  };

  MapView.prototype.buildMarkers = function () {
    var self = this;
    global.ENTITIES.forEach(function (entity) {
      var pos = self.project(entity.lat, entity.lon);
      var el = document.createElement('div');
      el.className = 'marker marker--' + (entity.labelSide || 'right');
      el.style.left = (pos.x * 100).toFixed(3) + '%';
      el.style.top = (pos.y * 100).toFixed(3) + '%';
      el.setAttribute('data-entity', entity.id);
      el.setAttribute('title', entity.name + ' · ' + entity.legal + ' (' + entity.city + ')');
      el.innerHTML =
        '<span class="marker__pin"><span class="marker__pulse"></span></span>' +
        '<div class="marker__card">' +
          '<div class="marker__name">' + entity.name + '<span class="marker__code">' + entity.code + '</span></div>' +
          '<div class="marker__clock"><span class="marker__time">--:--</span><span class="marker__meta"></span></div>' +
          '<div class="marker__city">' + entity.city + '</div>' +
        '</div>';
      self.overlay.appendChild(el);
      self.markers[entity.id] = el;
    });
  };

  MapView.prototype.setSelection = function (ids) {
    this.selected = ids;
    var self = this;
    global.ENTITIES.forEach(function (entity) {
      var active = !ids || ids.indexOf(entity.id) !== -1;
      self.markers[entity.id].classList.toggle('is-dimmed', !active);
    });
  };

  /** 회의 슬롯을 지도에 반영. null 이면 실시간 시계 모드로 복귀 */
  MapView.prototype.setMeeting = function (meeting) {
    this.meeting = meeting;
    this.overlay.classList.toggle('is-meeting', !!meeting);
    this.updateClocks();
  };

  MapView.prototype.updateClocks = function () {
    var self = this;
    var now = Date.now();
    global.ENTITIES.forEach(function (entity) {
      var el = self.markers[entity.id];
      var timeEl = el.querySelector('.marker__time');
      var metaEl = el.querySelector('.marker__meta');
      el.classList.remove('is-core', 'is-ext', 'is-out', 'is-off');

      if (self.meeting && self.meeting.statusById[entity.id]) {
        var row = self.meeting.statusById[entity.id];
        timeEl.textContent = TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute);
        metaEl.textContent = TZ.DAY_KO[row.start.weekday] + ' · ' + row.statusLabel;
        el.classList.add('is-' + row.status);
      } else {
        var p = TZ.zonedParts(entity.tz, now);
        timeEl.textContent = TZ.pad(p.hour) + ':' + TZ.pad(p.minute);
        metaEl.textContent = TZ.DAY_KO[p.weekday] + ' · ' + TZ.offsetLabel(entity.tz, now).replace('UTC', '');
      }
    });
  };

  MapView.prototype.render = function () {
    var canvas = this.canvas;
    var rect = canvas.parentNode.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var width = Math.max(rect.width, 320);
    var height = width * (mask.rows / mask.cols) * (1); // 도트 격자 비율 유지
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var cellW = width / mask.cols;
    var cellH = height / mask.rows;
    // 화면이 좁으면 격자를 솎아내 도트가 뭉쳐 면으로 보이지 않게 한다
    var skip = cellW < 1.7 ? 2 : 1;
    var radius = Math.max(0.7, Math.min(cellW, cellH) * skip * 0.34);
    var sun = subsolarPoint(Date.now());

    for (var row = 0; row < mask.rows; row += skip) {
      var lat = mask.latMax - (row + 0.5) * mask.step;
      for (var col = 0; col < mask.cols; col += skip) {
        if (!isLand(col, row)) continue;
        var lon = mask.lonMin + (col + 0.5) * mask.step;
        var alt = solarAltitude(lat, lon, sun);
        ctx.fillStyle = alt > 3 ? COLORS.day : (alt > -6 ? COLORS.twilight : COLORS.night);
        ctx.beginPath();
        ctx.arc((col + 0.5) * cellW, (row + 0.5) * cellH, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  global.MapView = MapView;
})(window);
