from scripts.import_formulas import rows_from_tables


def test_rows_from_tables_skips_header_and_empty_col3():
    tables = [
        [
            ["Суп", "Рекомендуется", "Не рекомендуется"],
            [
                "Борщ",
                "Луна в гармоничном аспекте к Марсу",
                "Луна в напряжённом аспекте к Марсу",
            ],
            [
                "Кисель",
                "1. Если Луна в Козероге\n2. Если Марс в Раке",
                "",
            ],
        ]
    ]
    rows = rows_from_tables(tables)
    assert any(r["product"] == "Борщ" and r["polarity"] == "recommend" for r in rows)
    assert any(r["product"] == "Борщ" and r["polarity"] == "avoid" for r in rows)
    kisel = [r for r in rows if r["product"] == "Кисель"]
    assert len(kisel) == 2
    assert all(r["polarity"] == "recommend" for r in kisel)
    assert all(r["category"] == "Суп" for r in rows)


def test_product_not_split_on_commas_and_short_rows_padded():
    tables = [[["Напитки", "a", "b"], ["Чай, зелёный", "Солнце в Овне"]]]
    rows = rows_from_tables(tables)
    assert len(rows) == 1
    assert rows[0]["product"] == "Чай, зелёный"
    assert rows[0]["source_table"] == "1"
    assert rows[0]["source_row"] == "2"
    assert rows[0]["condition_key"] == "солнце в овне"
