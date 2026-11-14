"""ACR TI-RADS rule tests — must match web/src/lib/tirads.ts."""
import pytest

from app.pipeline import tirads


@pytest.mark.parametrize(
    "features,points,level",
    [
        (("CYSTIC", "ANECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 0, 1),
        (("SPONGIFORM", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 1, 2),
        (("MIXED", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["COMET_TAIL"]), 2, 2),
        (("SOLID", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 3, 3),
        (("SOLID", "HYPOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 4, 4),
        (("SOLID", "VERY_HYPOECHOIC", "TALLER_THAN_WIDE", "LOBULATED", ["PUNCTATE"]), 13, 5),
        (("SOLID", "HYPOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["MACRO", "RIM"]), 7, 5),  # foci are additive
    ],
)
def test_score(features, points, level):
    assert tirads.score(*features) == (points, level)


@pytest.mark.parametrize(
    "level,size,action",
    [(1, 40, "NO_ACTION"), (3, 25, "FNA"), (3, 20, "US_FOLLOW_UP"), (3, 10, "NO_ACTION"),
     (4, 15, "FNA"), (4, 12, "US_FOLLOW_UP"), (5, 10, "FNA"), (5, 6, "US_FOLLOW_UP"), (5, 4, "NO_ACTION")],
)
def test_actions(level, size, action):
    assert tirads.suggest_action(level, size) == action


def test_volume():
    assert tirads.ellipsoid_volume_ml(20, 10, 10) == 1.05
