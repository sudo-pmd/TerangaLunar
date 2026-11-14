import numpy as np

from export import decode_site, encode_site


def test_roundtrip_to_hundredth_degree():
    rng = np.random.default_rng(1)
    n = 500
    a = {"sun_el": rng.uniform(-90, 90, n), "sun_az": rng.uniform(0, 359.99, n),
         "earth_el": rng.uniform(-90, 90, n), "earth_az": rng.uniform(0, 359.99, n)}
    mask = rng.uniform(0, 20, 720)
    d = decode_site(encode_site(a, mask), n, 720)
    for k in a:
        diff = np.abs(d[k] - a[k])
        if k.endswith("az"):
            diff = np.minimum(diff, 360 - diff)
        assert diff.max() <= 0.0051
    assert np.abs(d["mask"] - mask).max() <= 0.0051


def test_size_under_5mb_for_two_years_hourly():
    n = 731 * 24
    z = np.zeros(n)
    blob = encode_site({"sun_el": z, "sun_az": z, "earth_el": z, "earth_az": z}, np.zeros(720))
    assert len(blob) < 5 * 1024 * 1024
