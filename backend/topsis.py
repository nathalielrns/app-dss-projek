import math


def hitung_topsis(matriks: list, kriteria: list) -> list:
    """
    matriks: list of list, baris = alternatif, kolom = kriteria (nilai mentah)
    kriteria: list of dict {"bobot": float, "tipe": "benefit"/"cost"}

    Return: list skor preferensi akhir per alternatif (urutan sama dengan matriks)
    """
    jumlah_alternatif = len(matriks)
    jumlah_kriteria = len(kriteria)

    # Step 1: Normalisasi vektor (akar kuadrat jumlah kuadrat per kolom)
    matriks_normalisasi = [[0.0] * jumlah_kriteria for _ in range(jumlah_alternatif)]
    for j in range(jumlah_kriteria):
        penyebut = math.sqrt(sum(matriks[i][j] ** 2 for i in range(jumlah_alternatif)))
        for i in range(jumlah_alternatif):
            matriks_normalisasi[i][j] = matriks[i][j] / penyebut if penyebut != 0 else 0

    # Step 2: Matriks ternormalisasi terbobot
    matriks_terbobot = [
        [matriks_normalisasi[i][j] * kriteria[j]["bobot"] for j in range(jumlah_kriteria)]
        for i in range(jumlah_alternatif)
    ]

    # Step 3: Solusi ideal positif (A+) dan negatif (A-)
    solusi_positif = []
    solusi_negatif = []
    for j in range(jumlah_kriteria):
        kolom = [matriks_terbobot[i][j] for i in range(jumlah_alternatif)]
        if kriteria[j]["tipe"] == "benefit":
            solusi_positif.append(max(kolom))
            solusi_negatif.append(min(kolom))
        else:  # cost
            solusi_positif.append(min(kolom))
            solusi_negatif.append(max(kolom))

    # Step 4: Jarak ke solusi ideal positif & negatif
    jarak_positif = []
    jarak_negatif = []
    for i in range(jumlah_alternatif):
        dp = math.sqrt(sum((matriks_terbobot[i][j] - solusi_positif[j]) ** 2 for j in range(jumlah_kriteria)))
        dn = math.sqrt(sum((matriks_terbobot[i][j] - solusi_negatif[j]) ** 2 for j in range(jumlah_kriteria)))
        jarak_positif.append(dp)
        jarak_negatif.append(dn)

    # Step 5: Nilai preferensi (skor akhir)
    skor = []
    for i in range(jumlah_alternatif):
        total = jarak_positif[i] + jarak_negatif[i]
        nilai_preferensi = jarak_negatif[i] / total if total != 0 else 0
        skor.append(nilai_preferensi)

    return skor
