namespace apmorrowland;

using { apmorrowland as db } from '../db/schema';

service FestivalService {
  @cds.redirection.target entity Countries    as projection on db.Countries;
  @cds.redirection.target entity Artists      as projection on db.Artists;
  entity Performances as projection on db.Performances;
  @cds.redirection.target entity Reviews      as projection on db.Reviews;
  @cds.redirection.target entity Customers    as projection on db.Customers;
  @cds.redirection.target entity Items        as projection on db.Items;
  @cds.redirection.target entity Orders       as projection on db.Orders;
  @cds.redirection.target entity OrderItems   as projection on db.OrderItems;

  @readonly
  entity ArtistOverview as select from db.Artists as a
    left join db.Performances as p on p.artist.ID = a.ID
    left join db.Reviews as r on r.performance.ID = p.ID {
    key a.ID,
    a.name,
    a.genre,
    a.country.name as country,
    a.spotifyUrl,
    a.instagramHandle,
    cast(avg(r.rating) as Decimal(5,2)) as popularityScore
  } group by a.ID, a.name, a.genre, a.country.name, a.spotifyUrl, a.instagramHandle;

  @readonly
  entity OrdersOverview as select from db.Orders {
    key ID,
    date,
    type,
    status,
    customer.firstName,
    customer.lastName,
    cast((select sum(i.quantity * i.unitPrice) from db.OrderItems as i where i.order.ID = ID) as Decimal(15,2)) as totalAmount
  };
}
