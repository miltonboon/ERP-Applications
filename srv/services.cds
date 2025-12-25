namespace apmorrowland;

using { apmorrowland as db } from '../db/schema';

service Service {
  @cds.redirection.target entity Countries    as projection on db.Countries;
  @cds.redirection.target entity Artists      as projection on db.Artists;
  entity Performances as projection on db.Performances;
  @cds.redirection.target entity Reviews      as projection on db.Reviews;
  @cds.redirection.target entity Customers    as projection on db.Customers;
  @cds.redirection.target entity Items        as projection on db.Items;
  @cds.redirection.target entity Orders       as projection on db.Orders;
  @cds.redirection.target entity OrderItems   as projection on db.OrderItems;

  @readonly
  entity ArtistOverview as select from db.Artists {
    key ID,
    name,
    genre,
    country.name as country,
    cast((select avg(r.rating) from db.Reviews as r where r.performance.artist.ID = ID) as Decimal(5,2)) as popularityScore
  };

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
