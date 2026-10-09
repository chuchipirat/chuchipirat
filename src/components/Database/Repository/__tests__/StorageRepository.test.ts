/**
 * Unit-Tests für StorageRepository.
 *
 * Testet Upload, Remove, removeFolder, getPublicUrl und getTransformedUrl
 * mit einem gemockten Supabase-Storage-Client.
 */
import {StorageRepository} from "../StorageRepository";
import {createStorageMock} from "../__mocks__/storageMock";

/** Konkrete Implementierung für Tests */
class TestStorageRepository extends StorageRepository {
  bucketName = "media";
  folderPath = "users/";
}

describe("StorageRepository", () => {
  let repo: TestStorageRepository;
  let storageMock: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    storageMock = createStorageMock();
    repo = new TestStorageRepository();
    (repo as any).client = storageMock.client;
  });

  /* ------------------------------------------
  // upload()
  // ------------------------------------------ */
  describe("upload()", () => {
    test("Datei erfolgreich hochladen", async () => {
      const blob = new Blob(["test"], {type: "image/jpeg"});

      const result = await repo.upload("profile.jpg", blob, "image/jpeg");

      expect(storageMock.client.storage.from).toHaveBeenCalledWith("media");
      expect(storageMock.storageBucketMock.upload).toHaveBeenCalledWith(
        "users/profile.jpg",
        blob,
        {contentType: "image/jpeg", upsert: true}
      );
      expect(result.path).toBe("users/profile.jpg");
      expect(result.publicUrl).toContain("users/profile.jpg");
    });

    test("Fehler beim Upload werfen", async () => {
      storageMock.storageBucketMock.upload.mockResolvedValue({
        data: null,
        error: {message: "Upload failed"},
      });

      const blob = new Blob(["test"]);

      await expect(
        repo.upload("profile.jpg", blob, "image/jpeg")
      ).rejects.toEqual({message: "Upload failed"});
    });
  });

  /* ------------------------------------------
  // remove()
  // ------------------------------------------ */
  describe("remove()", () => {
    test("Datei erfolgreich löschen", async () => {
      await repo.remove("profile.jpg");

      expect(storageMock.storageBucketMock.remove).toHaveBeenCalledWith([
        "users/profile.jpg",
      ]);
    });

    test("Fehler beim Löschen werfen", async () => {
      storageMock.storageBucketMock.remove.mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.remove("profile.jpg")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });

  /* ------------------------------------------
  // removeFolder()
  // ------------------------------------------ */
  describe("removeFolder()", () => {
    /**
     * Baut einen `list()`-Eintrag, wie ihn Supabase liefert: Dateien haben
     * eine `id`, (virtuelle) Unterordner `id: null`.
     *
     * @param name - Name des Eintrags (ohne Pfad).
     * @param isFolder - `true` für einen Unterordner.
     * @returns Der Eintrag.
     */
    const listEntry = (name: string, isFolder = false) => ({
      name,
      id: isFolder ? null : `id-${name}`,
    });

    test("flacher Ordner: list() einmal, remove() mit allen Pfaden in einem Aufruf", async () => {
      storageMock.storageBucketMock.list.mockResolvedValueOnce({
        data: [listEntry("cover.jpg"), listEntry("avatar.png")],
        error: null,
      });

      await repo.removeFolder("user-1");

      expect(storageMock.storageBucketMock.list).toHaveBeenCalledTimes(1);
      expect(storageMock.storageBucketMock.list).toHaveBeenCalledWith(
        "users/user-1",
      );
      expect(storageMock.storageBucketMock.remove).toHaveBeenCalledTimes(1);
      expect(storageMock.storageBucketMock.remove).toHaveBeenCalledWith([
        "users/user-1/cover.jpg",
        "users/user-1/avatar.png",
      ]);
    });

    test("verschachtelter Ordner: listet Unterordner rekursiv, löscht alles in einem remove()", async () => {
      storageMock.storageBucketMock.list
        .mockResolvedValueOnce({
          data: [listEntry("cover.jpg"), listEntry("expenses", true)],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [listEntry("exp-1.pdf"), listEntry("exp-2.jpg")],
          error: null,
        });

      await repo.removeFolder("user-1");

      expect(storageMock.storageBucketMock.list).toHaveBeenCalledTimes(2);
      expect(storageMock.storageBucketMock.list).toHaveBeenNthCalledWith(
        2,
        "users/user-1/expenses",
      );
      expect(storageMock.storageBucketMock.remove).toHaveBeenCalledTimes(1);
      expect(storageMock.storageBucketMock.remove).toHaveBeenCalledWith([
        "users/user-1/cover.jpg",
        "users/user-1/expenses/exp-1.pdf",
        "users/user-1/expenses/exp-2.jpg",
      ]);
    });

    test("leerer Ordner: remove() wird nicht aufgerufen", async () => {
      storageMock.storageBucketMock.list.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await repo.removeFolder("user-1");

      expect(storageMock.storageBucketMock.list).toHaveBeenCalledTimes(1);
      expect(storageMock.storageBucketMock.remove).not.toHaveBeenCalled();
    });

    test("Fehler beim Auflisten werfen", async () => {
      storageMock.storageBucketMock.list.mockResolvedValueOnce({
        data: null,
        error: {message: "List failed"},
      });

      await expect(repo.removeFolder("user-1")).rejects.toEqual({
        message: "List failed",
      });
      expect(storageMock.storageBucketMock.remove).not.toHaveBeenCalled();
    });

    test("Fehler beim Löschen werfen", async () => {
      storageMock.storageBucketMock.list.mockResolvedValueOnce({
        data: [listEntry("cover.jpg")],
        error: null,
      });
      storageMock.storageBucketMock.remove.mockResolvedValueOnce({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.removeFolder("user-1")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });

  /* ------------------------------------------
  // getPublicUrl()
  // ------------------------------------------ */
  describe("getPublicUrl()", () => {
    test("Öffentliche URL generieren", () => {
      const url = repo.getPublicUrl("profile.jpg");

      expect(storageMock.client.storage.from).toHaveBeenCalledWith("media");
      expect(storageMock.storageBucketMock.getPublicUrl).toHaveBeenCalledWith(
        "users/profile.jpg"
      );
      expect(url).toContain("users/profile.jpg");
    });
  });

  /* ------------------------------------------
  // getTransformedUrl()
  // ------------------------------------------ */
  describe("getTransformedUrl()", () => {
    test("Transformierte URL mit Dimensionen generieren", () => {
      const url = repo.getTransformedUrl("profile.jpg", {
        width: 50,
        height: 50,
      });

      expect(storageMock.storageBucketMock.getPublicUrl).toHaveBeenCalledWith(
        "users/profile.jpg",
        {transform: {width: 50, height: 50}}
      );
      expect(url).toContain("users/profile.jpg");
    });
  });

  /* ------------------------------------------
  // Pfad-Zusammensetzung
  // ------------------------------------------ */
  test("folderPath korrekt mit Filename kombinieren", async () => {
    const blob = new Blob(["test"]);
    await repo.upload("abc123.jpg", blob);

    expect(storageMock.storageBucketMock.upload).toHaveBeenCalledWith(
      "users/abc123.jpg",
      blob,
      {contentType: undefined, upsert: true}
    );
  });
});
