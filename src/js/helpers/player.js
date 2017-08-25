'use strict';

const d3 = require('d3');
const logger = require('./logger');

/**
 * A simple player controller that interfaces with a DOM player control area.
 */
class D3Player {
  /**
   * @param {Object} data - the Data that decided what the player plays over.
   * @param {String} selector - The DOM selector for the player controls.
   */
  constructor(data, selector) {
    this.from = 0;
    this.current = 0;
    this.to = data.length - 1;
    this.timestamps = data.map(d => d.ts);
    this.speed = 1;
    this.playing = false;
    this.timer = null;
    this.setupDOM(selector);
    logger.debug(this);
  }

  setupDOM(selector) {
    const $elem = $(selector);
    $elem.find('.play-pause').on('click', () => {
      this.playPause();
      return false;
    });

    $elem.find('.rewind').on('click', () => {
      this.rewind();
      return false;
    });

    $elem.find('.fast-forward').on('click', () => {
      this.fastForward();
      return false;
    });

    this.dom = $elem;
  }

  on(eventName, fun) {
    this.dom.on(eventName, fun);
  }

  rewind() {
    this.current = this.from;
    this.dom.trigger('time.rewind');
  }

  fastForward() {
    this.current = this.to - 1;
  }

  sleep(duration) {
    // Cannot sleep if it's not playing.
    if (!this.playing) return;
    this.dom.trigger('time.sleep', duration);
    this.playPause();
    this.disable();
    d3.timeout(() => {
      this.playPause();
      this.enable();
    }, duration);
  }

  update() {
    // Update the playhead position
    if (this.speed > 0) this.current++;
    else this.current--;

    // If we reached the beginning or end, stop playing.
    if (this.current < this.from || this.current > this.to) {
      this.playPause();
      this.current = this.current < this.from ? this.from : this.to;
      return;
    }

    this.dom.trigger('time.update', [this.current, this.timestamps[this.current]]);
  }

  adjustSpeed() {
    if (this.timer) this.timer.stop();
    if (!this.playing) return;

    // The higher the speed, the lower the interval.
    this.timer = d3.timer(() => this.update());
  }

  playPause() {
    // Toggle the play state
    this.playing = !this.playing;

    // Toggle the class names for the play pause button
    const $pp = this.dom.find('.play-pause')
      .toggleClass('play pause');
    const url = this.playing ?
      '/images/icons/icons.svg#pause' : '/images/icons/icons.svg#play';
    $pp.find('use').attr('xlink:href', url);

    this.adjustSpeed();
  }

  disable() {
    this.dom.find('a').addClass('disabled');
  }

  enable() {
    this.dom.find('a').removeClass('disabled');
  }
}

module.exports = D3Player;
