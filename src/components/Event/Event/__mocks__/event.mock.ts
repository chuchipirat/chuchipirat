import Event from "../event.class";

export const event: Event = {
  uid: "wGhsPDH0WI9IKvg9ERXg",
  name: "Test Kurs 2021",
  motto: "Testen bis zum Umfallen",
  location: "Testhausen",
  pictureSrc:
    "https://d33wubrfki0l68.cloudfront.net/7ab37629fb8f2b135083d8301a67be7d3d37ca52/d6fe3/img/content/feature-fast.png",
  cooks: [
    {
      displayName: "Test User",
      motto: "🤪 ich teste mich dumm und dämlich...",
      pictureSrc: "https://jestjs.io/img/opengraph.png",
      uid: "RvLIR9NDGOWPwos8PrSZVgfIZvj9",
    },
  ],
  numberOfDays: 9,
  dates: [
    {
      uid: "ZMVPs",
      pos: 1,
      from: new Date(2020, 8, 5),
      to: new Date(2020, 8, 5),
    },
    {
      uid: "RZD5J",
      pos: 2,
      from: new Date(2020, 9, 10),
      to: new Date(2020, 9, 17),
    },
  ],
  maxDate: new Date(2020, 9, 17),
  authUsers: ["RvLIR9NDGOWPwos8PrSZVgfIZvj9"],
  created: {
    date: new Date(2020, 7, 1),
    fromDisplayName: "Test User",
    fromUid: "RvLIR9NDGOWPwos8PrSZVgfIZvj9",
  },
  lastChange: {
    date: new Date(2020, 7, 1),
    fromDisplayName: "Test User",
    fromUid: "RvLIR9NDGOWPwos8PrSZVgfIZvj9",
  },
  refDocuments: [],
};

export default event;
