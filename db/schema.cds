namespace apmorrowland;

using { managed, cuid } from '@sap/cds/common';

type Genre : String enum {
  POP;
  ROCK;
  HIPHOP;
  EDM;
  TECHNO;
  HOUSE;
  JAZZ;
  CLASSICAL;
  RNB;
  INDIE;
  METAL;
  LATIN;
  AFROBEATS;
}

type OrderType : String enum {
  Ticket;
  Merchandise;
  FoodDrinks;
}

type OrderStatus : String enum {
  Draft;
  Submitted;
  Paid;
  Cancelled;
}

entity Countries : cuid {
  code  : String(3)  @mandatory;
  name  : String(80) @mandatory;
}

entity Artists : cuid, managed {
  name            : String(120) @mandatory;
  country         : Association to Countries @mandatory;
  genres          : array of Genre @mandatory;
  biography       : LargeString;
  instagramHandle : String(60);
  spotifyUrl      : String(500);
  avatar          : LargeBinary @Core.MediaType : avatarMimeType;
  avatarMimeType  : String(80);

  performances    : Composition of many Performances on performances.artist = $self;
}

entity Stages : cuid {
  name : String(120) @mandatory;
}

entity FestivalDays : cuid {
  date      : Date    @mandatory;
  dayNumber : Integer @mandatory;
}

entity Performances : cuid, managed {
  startTime : Time    @mandatory;
  endTime   : Time    @mandatory;
  stage     : Association to Stages @mandatory;
  day       : Association to FestivalDays @mandatory;

  artist   : Association to Artists @mandatory;
  reviews  : Composition of many Reviews on reviews.performance = $self;
}

entity Reviews : cuid, managed {
  rating       : Integer @mandatory;
  date         : Date @mandatory;
  comment      : String(800);
  customerName : String(120) @mandatory;

  performance  : Association to Performances @mandatory;
}

entity Customers : cuid, managed {
  firstName : String(80)  @mandatory;
  lastName  : String(80)  @mandatory;

  orders    : Composition of many Orders on orders.customer = $self;
}

entity Items : cuid, managed {
  name  : String(120) @mandatory;
  stock : Integer @mandatory;
  price : Decimal(9,2) @mandatory;

  type  : OrderType @mandatory;
}

entity Orders : cuid, managed {
  date     : Date @mandatory;
  type     : OrderType @mandatory;
  status   : OrderStatus @mandatory default 'Draft';

  customer : Association to Customers @mandatory;
  items    : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid, managed {
  order    : Association to Orders @mandatory;
  item     : Association to Items @mandatory;

  quantity : Integer @mandatory;
  unitPrice: Decimal(9,2) @mandatory;
}
