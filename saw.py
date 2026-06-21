def hitung_saw(matriks: list, kriteria: list) -> list:
    """
    matriks: list of list, baris = alternatif, kolom = kriteria (nilai mentah)
    kriteria: list of dict {"bobot": float, "tipe": "benefit"/"cost"}

    Return: list skor akhir per alternatif (urutan sama dengan matriks)
    """
    jumlah_alternatif = len(matriks)
    jumlah_kriteria = len(kriteria)

    # Step 1: Normalisasi matriks
    matriks_normalisasi = [[0.0] * jumlah_kriteria for _ in range(jumlah_alternatif)]

    for j in range(jumlah_kriteria):
        kolom = [matriks[i][j] for i in range(jumlah_alternatif)]
        tipe = kriteria[j]["tipe"]

        if tipe == "benefit":
            maksimum = max(kolom)
            for i in range(jumlah_alternatif):
                matriks_normalisasi[i][j] = matriks[i][j] / maksimum if maksimum != 0 else 0
        else:  # cost
            minimum = min(kolom)
            for i in range(jumlah_alternatif):
                matriks_normalisasi[i][j] = minimum / matriks[i][j] if matriks[i][j] != 0 else 0

    # Step 2: Kalikan dengan bobot, jumlahkan per baris (alternatif)
    skor = []
    for i in range(jumlah_alternatif):
        total = sum(matriks_normalisasi[i][j] * kriteria[j]["bobot"] for j in range(jumlah_kriteria))
        skor.append(total)

    return skor
