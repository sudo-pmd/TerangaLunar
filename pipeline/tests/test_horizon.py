import numpy as np
import pytest

from horizon import ORIENTS, Dem, horizon_mask

R = 1737400.0


def make(arr=None, orient=None):
    arr = np.zeros((601, 601), dtype=np.int16) if arr is None else arr
    return Dem(arr, 80.0, R, None, 1.0, 0.0, 4 if orient is None else orient)


def test_pole_at_center():
    d = make()
    col, row = d.project(-90.0, 0.0)
    assert (col, row) == pytest.approx((300.0, 300.0))


def test_project_roundtrip_all_orients():
    for k in range(len(ORIENTS)):
        d = make(orient=k)
        col, row = np.array([250.3, 351.7]), np.array([310.2, 280.9])
        lat, lon = d.unproject(col, row)
        c2, r2 = d.project(lat, lon)
        assert c2 == pytest.approx(col, abs=1e-6) and r2 == pytest.approx(row, abs=1e-6)


def test_known_distance_from_pole():
    d = make()
    col, row = d.project(-89.0, 0.0)
    dist_km = np.hypot(col - 300, row - 300) * 80 / 1000
    assert dist_km == pytest.approx(30.3, abs=0.2)


def test_flat_terrain_gives_zero_mask():
    m, cov = horizon_mask(make(), -90.0, 0.0, mast_m=0.0, dmax_m=20000)
    assert np.abs(m).max() < 0.01 and cov > 0.9


def test_bump_raises_mask_only_in_its_direction():
    d = make()
    delta = np.degrees(1000 / R)
    col, row = d.project(-90 + delta, 90.0)  # bosse à 1 km, azimut 90°
    r, c = int(round(float(row))), int(round(float(col)))
    d.a[r - 3:r + 4, c - 3:c + 4] = 1000
    m, _ = horizon_mask(d, -90.0, 0.0, mast_m=0.0, dmax_m=20000)
    assert 38 < m[180] < 56  # azimut 90° (pas 0,5°)
    assert m[540] < 0.01  # azimut 270°


def test_site_outside_ldem_has_no_relief():
    m, cov = horizon_mask(make(), -70.0, 10.0, dmax_m=20000)
    assert cov == 0.0 and m.max() == 0.0
