from scripts.csv_io import FIELDNAMES, read_csv, write_csv


def test_write_read_csv_round_trip(tmp_path):
    path = tmp_path / "nested" / "out.csv"
    rows = [
        {
            "category": "Суп",
            "product": "Борщ",
            "polarity": "recommend",
            "condition": "Луна в Козероге, аспект",
            "condition_key": "луна в козероге аспект",
            "canonical_key": "луна в козероге аспект",
            "source_table": "1",
            "source_row": "2",
        },
        {
            "category": "Суп",
            "product": "Кисель",
            "polarity": "avoid",
            "condition": "Марс",
            "condition_key": "марс",
            "canonical_key": "марс",
            "source_table": "1",
            "source_row": "3",
        },
    ]
    write_csv(path, rows)
    assert path.exists()
    assert read_csv(path) == rows
    assert list(rows[0]) == FIELDNAMES
