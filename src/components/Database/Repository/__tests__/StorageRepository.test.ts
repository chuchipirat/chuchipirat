/**
 * Unit-Tests für StorageRepository.
 *
 * Testet Upload, Remove, getPublicUrl und getTransformedUrl
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
