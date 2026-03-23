import {AuthService} from "./AuthService";
import {UserRepository} from "./Repository/UserRepository";
import {UserStorageRepository} from "./Repository/UserStorageRepository";
import {EventStorageRepository} from "./Repository/EventStorageRepository";
import {GlobalSettingsRepository} from "./Repository/GlobalSettingsRepository";
import {SystemMessageRepository} from "./Repository/SystemMessageRepository";
import {DepartmentRepository} from "./Repository/DepartmentRepository";
import {UnitRepository} from "./Repository/UnitRepository";
import {MaterialRepository} from "./Repository/MaterialRepository";
import {ProductRepository} from "./Repository/ProductRepository";
import {UnitConversionBasicRepository} from "./Repository/UnitConversionBasicRepository";
import {UnitConversionProductRepository} from "./Repository/UnitConversionProductRepository";
import {RecipeRepository} from "./Repository/RecipeRepository";
import {RecipeIngredientRepository} from "./Repository/RecipeIngredientRepository";
import {RecipePreparationStepRepository} from "./Repository/RecipePreparationStepRepository";
import {RecipeMaterialRepository} from "./Repository/RecipeMaterialRepository";
import {RecipeRatingRepository} from "./Repository/RecipeRatingRepository";
import {RecipeCommentRepository} from "./Repository/RecipeCommentRepository";
import {EventRepository} from "./Repository/EventRepository";
import {EventGroupConfigRepository} from "./Repository/EventGroupConfigRepository";
import {MenuplanRepository} from "./Repository/MenuplanRepository";
import {UsedRecipeListRepository} from "./Repository/UsedRecipeListRepository";
import {ShoppingListRepository} from "./Repository/ShoppingListRepository";
import {MaterialListRepository} from "./Repository/MaterialListRepository";
import {RequestRepository} from "./Repository/RequestRepository";
import {RequestCommentRepository} from "./Repository/RequestCommentRepository";
import {FeedRepository} from "./Repository/FeedRepository";
import {DonationRepository} from "./Repository/DonationRepository";
import {StatsRepository} from "./Repository/StatsRepository";
import {AdminOperationsRepository} from "./Repository/AdminOperationsRepository";
import {CronJobLogRepository} from "./Repository/CronJobLogRepository";
import {MailLogRepository} from "./Repository/MailLogRepository";
import {supabaseAdmin} from "./supabaseClient";

/* =====================================================================
// DatabaseService — Zentraler Einstiegspunkt für Datenbankzugriff
// Ersetzt die DB-bezogenen Teile von firebase.class.ts.
// Neue Repositories werden hier als Properties ergänzt,
// sobald sie implementiert sind (z.B. EventRepository).
// ===================================================================== */

/**
 * Zentraler Service für den Zugriff auf die Supabase/Postgres-Datenbank.
 *
 * Bündelt alle Repository-Instanzen und den AuthService und wird über
 * den DatabaseContext in der App bereitgestellt. Entspricht dem
 * Firebase-Pendant `firebase.user`, `firebase.event` usw. — nur mit
 * Repository-Pattern.
 *
 * @property auth - Service für Supabase Auth Operationen
 * @property users - Repository für Benutzer-CRUD-Operationen (RLS aktiv)
 * @property globalSettings - Repository für globale Einstellungen
 * @property systemMessages - Repository für Systemmeldungen
 * @property departments - Repository für Abteilungen
 * @property units - Repository für Einheiten
 * @property materials - Repository für Materialien
 * @property products - Repository für Produkte
 * @property unitConversionBasic - Repository für Standard-Einheitenumrechnungen
 * @property unitConversionProducts - Repository für produktspezifische Einheitenumrechnungen
 * @property recipes - Repository für Rezept-Kopfdaten
 * @property recipeIngredients - Repository für Rezept-Zutaten und Abschnitts-Trennzeilen
 * @property recipePreparationSteps - Repository für Zubereitungsschritte
 * @property recipeMaterials - Repository für Materialpositionen
 * @property recipeRatings - Repository für Rezeptbewertungen
 * @property recipeComments - Repository für Rezeptkommentare
 * @property events - Repository für Events (Kopfdaten, Köche, Zeitscheiben)
 * @property eventGroupConfig - Repository für die Gruppenconfig eines Events
 * @property menuplan - Repository für den Menuplan eines Events
 * @property usedRecipeLists - Repository für benannte Rezeptlisten eines Events
 * @property shoppingLists - Repository für Einkaufslisten eines Events
 * @property materialLists - Repository für Materiallisten eines Events
 * @property requests - Repository für Anträge (Rezept-Veröffentlichung, Fehlermeldungen)
 * @property requestComments - Repository für Antrags-Kommentare
 * @property feeds - Repository für Feed-Einträge (Aktivitätsübersicht)
 * @property donations - Repository für Spenden (Payrexx-Integration)
 * @property stats - Repository für Plattform-Statistiken (KPIs)
 * @property adminOps - Repository für Admin-Operationen (Merge, Convert, Where-Used)
 * @property storage - Storage-Repositories für Datei-Uploads (Bilder etc.)
 * @property admin - Admin-Repositories mit Service Role Key (umgeht RLS).
 *   Nur für Migration und Admin-Operationen verwenden. Ist `null`, falls
 *   der Service Role Key nicht konfiguriert ist.
 */
export class DatabaseService {
  auth: AuthService;
  users: UserRepository;
  globalSettings: GlobalSettingsRepository;
  systemMessages: SystemMessageRepository;
  departments: DepartmentRepository;
  units: UnitRepository;
  materials: MaterialRepository;
  products: ProductRepository;
  unitConversionBasic: UnitConversionBasicRepository;
  unitConversionProducts: UnitConversionProductRepository;
  recipes: RecipeRepository;
  recipeIngredients: RecipeIngredientRepository;
  recipePreparationSteps: RecipePreparationStepRepository;
  recipeMaterials: RecipeMaterialRepository;
  recipeRatings: RecipeRatingRepository;
  recipeComments: RecipeCommentRepository;
  events: EventRepository;
  eventGroupConfig: EventGroupConfigRepository;
  menuplan: MenuplanRepository;
  usedRecipeLists: UsedRecipeListRepository;
  shoppingLists: ShoppingListRepository;
  materialLists: MaterialListRepository;
  requests: RequestRepository;
  requestComments: RequestCommentRepository;
  feeds: FeedRepository;
  donations: DonationRepository;
  stats: StatsRepository;
  adminOps: AdminOperationsRepository;
  cronJobLog: CronJobLogRepository;
  mailLog: MailLogRepository;
  storage: {users: UserStorageRepository; events: EventStorageRepository};
  admin: {
    users: UserRepository;
    globalSettings: GlobalSettingsRepository;
    systemMessages: SystemMessageRepository;
    departments: DepartmentRepository;
    units: UnitRepository;
    materials: MaterialRepository;
    products: ProductRepository;
    unitConversionBasic: UnitConversionBasicRepository;
    unitConversionProducts: UnitConversionProductRepository;
    recipes: RecipeRepository;
    recipeIngredients: RecipeIngredientRepository;
    recipePreparationSteps: RecipePreparationStepRepository;
    recipeMaterials: RecipeMaterialRepository;
    recipeRatings: RecipeRatingRepository;
    recipeComments: RecipeCommentRepository;
    events: EventRepository;
    eventGroupConfig: EventGroupConfigRepository;
    menuplan: MenuplanRepository;
    usedRecipeLists: UsedRecipeListRepository;
    shoppingLists: ShoppingListRepository;
    materialLists: MaterialListRepository;
    requests: RequestRepository;
    requestComments: RequestCommentRepository;
    feeds: FeedRepository;
    donations: DonationRepository;
    stats: StatsRepository;
    storage: {users: UserStorageRepository; events: EventStorageRepository};
  } | null;

  constructor() {
    this.auth = new AuthService();
    this.users = new UserRepository();
    this.globalSettings = new GlobalSettingsRepository();
    this.systemMessages = new SystemMessageRepository();
    this.departments = new DepartmentRepository();
    this.units = new UnitRepository();
    this.materials = new MaterialRepository();
    this.products = new ProductRepository();
    this.unitConversionBasic = new UnitConversionBasicRepository();
    this.unitConversionProducts = new UnitConversionProductRepository();
    this.recipes = new RecipeRepository();
    this.recipeIngredients = new RecipeIngredientRepository();
    this.recipePreparationSteps = new RecipePreparationStepRepository();
    this.recipeMaterials = new RecipeMaterialRepository();
    this.recipeRatings = new RecipeRatingRepository();
    this.recipeComments = new RecipeCommentRepository();
    this.events = new EventRepository();
    this.eventGroupConfig = new EventGroupConfigRepository();
    this.menuplan = new MenuplanRepository();
    this.usedRecipeLists = new UsedRecipeListRepository();
    this.shoppingLists = new ShoppingListRepository();
    this.materialLists = new MaterialListRepository();
    this.requests = new RequestRepository();
    this.requestComments = new RequestCommentRepository();
    this.feeds = new FeedRepository();
    this.donations = new DonationRepository();
    this.stats = new StatsRepository();
    this.adminOps = new AdminOperationsRepository();
    this.cronJobLog = new CronJobLogRepository();
    this.mailLog = new MailLogRepository();
    this.storage = {users: new UserStorageRepository(), events: new EventStorageRepository()};
    this.admin = supabaseAdmin
      ? {
          users: new UserRepository(supabaseAdmin),
          globalSettings: new GlobalSettingsRepository(supabaseAdmin),
          systemMessages: new SystemMessageRepository(supabaseAdmin),
          departments: new DepartmentRepository(supabaseAdmin),
          units: new UnitRepository(supabaseAdmin),
          materials: new MaterialRepository(supabaseAdmin),
          products: new ProductRepository(supabaseAdmin),
          unitConversionBasic: new UnitConversionBasicRepository(supabaseAdmin),
          unitConversionProducts: new UnitConversionProductRepository(supabaseAdmin),
          recipes: new RecipeRepository(supabaseAdmin),
          recipeIngredients: new RecipeIngredientRepository(supabaseAdmin),
          recipePreparationSteps: new RecipePreparationStepRepository(supabaseAdmin),
          recipeMaterials: new RecipeMaterialRepository(supabaseAdmin),
          recipeRatings: new RecipeRatingRepository(supabaseAdmin),
          recipeComments: new RecipeCommentRepository(supabaseAdmin),
          events: new EventRepository(supabaseAdmin),
          eventGroupConfig: new EventGroupConfigRepository(supabaseAdmin),
          menuplan: new MenuplanRepository(supabaseAdmin),
          usedRecipeLists: new UsedRecipeListRepository(supabaseAdmin),
          shoppingLists: new ShoppingListRepository(supabaseAdmin),
          materialLists: new MaterialListRepository(supabaseAdmin),
          requests: new RequestRepository(supabaseAdmin),
          requestComments: new RequestCommentRepository(supabaseAdmin),
          feeds: new FeedRepository(supabaseAdmin),
          donations: new DonationRepository(supabaseAdmin),
          stats: new StatsRepository(supabaseAdmin),
          storage: {users: new UserStorageRepository(supabaseAdmin), events: new EventStorageRepository(supabaseAdmin)},
        }
      : null;
  }
}

export default DatabaseService;
