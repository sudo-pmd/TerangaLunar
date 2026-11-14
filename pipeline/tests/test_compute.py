"""Ordres de grandeur (section 10 du cahier) avec les éphémérides provisoires."""
import numpy as np
import pytest

import compute


@pytest.fixture(scope="module")
def sky():
    compute.load_kernels()
    ets = compute.time_grid("2027-01-01", 60, 3600)
    sun, earth = compute.vectors_provisional(ets)
    return ets, sun, earth, compute.moon_radius_km()


def test_radius(sky):
    assert sky[3] == pytest.approx(1737.4, abs=0.1)


def test_pole_sun_stays_near_horizon(sky):
    _, sun, _, r = sky
    az, el = compute.az_el(sun, -90.0, 0.0, r)
    assert el.max() < 1.8 and el.min() > -1.8


def test_pole_earth_near_horizon(sky):
    _, _, earth, r = sky
    _, el = compute.az_el(earth, -90.0, 0.0, r)
    assert np.abs(el).max() < 9.0


def test_equator_sun_high_and_cycle(sky):
    _, sun, _, r = sky
    _, el = compute.az_el(sun, 0.0, 0.0, r)
    assert el.max() > 80
    rises = np.sum((el[1:] > 0) & (el[:-1] <= 0))
    assert rises in (2, 3)  # ~29,5 jours -> 2 levers en 60 jours


def test_azimuth_clockwise_east(sky):
    _, sun, _, r = sky
    az, el = compute.az_el(sun, 0.0, 0.0, r)
    i = int(np.argmax((el[1:] > 0) & (el[:-1] <= 0)))  # un lever
    assert 45 < az[i + 1] < 135 or 225 < az[i + 1] < 315  # lever ~ Est (ou Ouest en rotation lente)
