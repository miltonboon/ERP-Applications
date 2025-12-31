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
}
