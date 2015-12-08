const galilSettings = Meteor.settings.public.galil.connection;
MainGalil = new Galil(galilSettings);
