from scripts.condition_text import normalize_key, split_conditions


def test_normalize_key_yo_case_punctuation_whitespace():
    assert normalize_key("  Уран. ") == normalize_key("уран")
    assert normalize_key("напряжённый") == normalize_key("напряженный")
    assert normalize_key("аспект,") == normalize_key("аспект")
    assert normalize_key("a   b") == normalize_key("a b")


def test_split_numbered_and_newlines():
    text = (
        "1. Луна в гармоничном аспекте к Плутону,\n"
        "2. или Сатурн в квадрате к любой планете"
    )
    parts = split_conditions(text)
    assert len(parts) == 2
    assert parts[0].startswith("Луна")
    assert "Сатурн" in parts[1]


def test_split_skips_empty_and_does_not_comma_split():
    assert split_conditions("") == []
    assert split_conditions("   ") == []
    one = split_conditions("Луна в Близнецах, Стрельце, Рыбах")
    assert len(one) == 1
