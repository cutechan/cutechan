/**
 * Simple pure CSS spinner.
 *
 * Based on https://loading.io/css/ example.
 *
 * @module cutechan/spinner
 */

import { h } from "preact";

function Spinner() {
  return (
    <div class="spinner">
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
      <div class="spinner__blade" />
    </div>
  );
}

export default Spinner;
