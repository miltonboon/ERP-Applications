namespace apmorrowland;

using { apmorrowland as db } from '../db/schema';

service FestivalService {
  entity Countries    as projection on db.Countries;
  entity Artists      as projection on db.Artists;
  entity FestivalDays as projection on db.FestivalDays;
  entity Performances as projection on db.Performances;
  entity Reviews      as projection on db.Reviews;
  entity Customers    as projection on db.Customers;
  entity Items        as projection on db.Items;
  @cds.redirection.target entity Orders       as projection on db.Orders;
  entity OrderItems   as projection on db.OrderItems;
  entity Stages       as projection on db.Stages;

  @readonly
  entity ArtistOverview as select from db.Artists as a
    left join db.Performances as p on p.artist.ID = a.ID
    left join db.Reviews as r on r.performance.ID = p.ID {
    key a.ID,
    a.name,
    a.genres,
    a.country.name as country,
    a.avatar,
    a.avatarMimeType,
    cast(round(avg(r.rating) * 2, 0) / 2 as Decimal(5,1)) as popularityScore
  } group by a.ID, a.name, a.genres, a.country.name, a.avatar, a.avatarMimeType;

  @readonly
  entity OrdersOverview as select from db.Orders as o
    left join db.OrderItems as i on o.ID = i.order.ID {
    key o.ID,
    o.date,
    o.type,
    o.status,
    o.customer.firstName as customerFirstName,
    o.customer.lastName  as customerLastName,
    coalesce(round(sum(i.quantity * i.unitPrice), 2), 0) as totalAmount : Decimal(15,2)
  } group by o.ID, o.date, o.type, o.status, o.customer.firstName, o.customer.lastName;

  @readonly
  entity ArtistLeaderboard as select from db.Artists as a
    left join db.Performances as p on p.artist.ID = a.ID
    left join db.Reviews as r on r.performance.ID = p.ID {
    key a.ID,
    a.name,
    a.genres,
    a.country.name as country,
    a.avatar,
    a.avatarMimeType,
    coalesce(cast(round(avg(r.rating) * 10, 0) / 10 as Decimal(4,1)), 0) as averageRating : Decimal(4,1),
    coalesce(count(r.ID), 0) as reviewCount : Integer,
    coalesce(count(distinct p.ID), 0) as performanceCount : Integer
  } group by a.ID, a.name, a.genres, a.country.name, a.avatar, a.avatarMimeType;

  @readonly
  entity PerformanceLeaderboard as select from db.Performances as p
    left join db.Reviews as r on r.performance.ID = p.ID {
    key p.ID,
    p.artist.ID as artistId,
    p.artist.name as artistName,
    p.artist.genres as genres,
    p.stage.name as stageName,
    p.day.dayNumber as dayNumber,
    p.day.date as dayDate,
    p.startTime,
    p.endTime,
    coalesce(cast(round(avg(r.rating) * 10, 0) / 10 as Decimal(4,1)), 0) as averageRating : Decimal(4,1),
    coalesce(count(r.ID), 0) as reviewCount : Integer
  } group by p.ID, p.artist.ID, p.artist.name, p.artist.genres, p.stage.name, p.day.dayNumber, p.day.date, p.startTime, p.endTime;
}
